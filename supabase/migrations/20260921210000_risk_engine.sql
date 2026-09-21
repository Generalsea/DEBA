-- DEBA risk rules and order risk assessments.
-- Rules are advisory unless an assessment is high/pending, in which case payment is held for review.

create table if not exists public.risk_rule_config (
  key text primary key,
  numeric_value numeric not null check (numeric_value >= 0),
  updated_at timestamptz not null default now()
);

insert into public.risk_rule_config(key,numeric_value) values
  ('new_account_hours',24),
  ('new_account_score',20),
  ('rapid_orders_10m',3),
  ('rapid_orders_score',30),
  ('high_value_egp',50000),
  ('high_value_score',15),
  ('open_disputes_threshold',2),
  ('open_disputes_score',20),
  ('failed_payments_threshold',2),
  ('failed_payments_score',25),
  ('high_risk_score',50)
on conflict (key) do nothing;

create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  score numeric not null check (score between 0 and 100),
  level text not null check (level in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  reasons jsonb not null default '[]'::jsonb,
  model_version text not null default 'rules-v1',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists risk_assessments_status_level_idx
  on public.risk_assessments(status,level,created_at desc);
create index if not exists risk_assessments_reviewed_by_idx
  on public.risk_assessments(reviewed_by);

create or replace function private.touch_risk_updated_at()
returns trigger language plpgsql set search_path=''
as $$
begin new.updated_at=now(); return new; end;
$$;

drop trigger if exists risk_assessments_touch_updated_at on public.risk_assessments;
create trigger risk_assessments_touch_updated_at
before update on public.risk_assessments
for each row execute function private.touch_risk_updated_at();

alter table public.risk_rule_config enable row level security;
alter table public.risk_assessments enable row level security;

drop policy if exists risk_rules_admin_select on public.risk_rule_config;
create policy risk_rules_admin_select on public.risk_rule_config
for select to authenticated using ((select private.is_admin()));

drop policy if exists risk_assessments_participant_select on public.risk_assessments;
create policy risk_assessments_participant_select on public.risk_assessments
for select to authenticated using (
  (select private.is_admin())
  or exists (
    select 1 from public.orders o
    where o.id=risk_assessments.order_id
      and (o.buyer_id=(select auth.uid()) or o.seller_id=(select auth.uid()))
  )
);

revoke all on table public.risk_rule_config,public.risk_assessments from anon,authenticated;
grant select on public.risk_rule_config,public.risk_assessments to authenticated;
grant all on all tables in schema public to service_role;

create or replace function private.assess_order_risk(
  p_order_id uuid,p_buyer_id uuid,p_total numeric
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_score numeric:=0;
  v_reasons jsonb:='[]'::jsonb;
  v_level text:='low';
  v_status text:='approved';
  v_account_created timestamptz;
  v_rapid_count integer;
  v_open_disputes integer;
  v_failed_payments integer;
  v_value_threshold numeric;
begin
  select created_at into v_account_created from public.profiles where id=p_buyer_id;

  if v_account_created is not null and
     extract(epoch from (now()-v_account_created))/3600 <
       coalesce((select numeric_value from public.risk_rule_config where key='new_account_hours'),24) then
    v_score:=v_score+coalesce((select numeric_value from public.risk_rule_config where key='new_account_score'),20);
    v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('code','new_account','detail','Buyer account is newly created'));
  end if;

  select count(*) into v_rapid_count
  from public.orders
  where buyer_id=p_buyer_id
    and created_at>=now()-interval '10 minutes'
    and id<>p_order_id;

  if v_rapid_count+1>=coalesce((select numeric_value from public.risk_rule_config where key='rapid_orders_10m'),3) then
    v_score:=v_score+coalesce((select numeric_value from public.risk_rule_config where key='rapid_orders_score'),30);
    v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('code','rapid_orders','detail','Multiple orders created in a short period','count',v_rapid_count+1));
  end if;

  v_value_threshold:=coalesce((select numeric_value from public.risk_rule_config where key='high_value_egp'),50000);

  if p_total>=v_value_threshold then
    v_score:=v_score+coalesce((select numeric_value from public.risk_rule_config where key='high_value_score'),15);
    v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('code','high_value','detail','Order value exceeds configured review threshold','threshold',v_value_threshold));
  end if;

  select count(*) into v_open_disputes
  from public.disputes d join public.orders o on o.id=d.order_id
  where o.buyer_id=p_buyer_id and d.status in ('open','under_review');

  if v_open_disputes>=coalesce((select numeric_value from public.risk_rule_config where key='open_disputes_threshold'),2) then
    v_score:=v_score+coalesce((select numeric_value from public.risk_rule_config where key='open_disputes_score'),20);
    v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('code','open_disputes','detail','Buyer has multiple open disputes','count',v_open_disputes));
  end if;

  select count(*) into v_failed_payments from public.payments
  where order_id=p_order_id and status='failed';

  if v_failed_payments>=coalesce((select numeric_value from public.risk_rule_config where key='failed_payments_threshold'),2) then
    v_score:=v_score+coalesce((select numeric_value from public.risk_rule_config where key='failed_payments_score'),25);
    v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('code','failed_payments','detail','Repeated failed payment attempts','count',v_failed_payments));
  end if;

  v_score:=least(100,v_score);

  if v_score>=coalesce((select numeric_value from public.risk_rule_config where key='high_risk_score'),50) then
    v_level:='high'; v_status:='pending';
  elsif v_score>=25 then
    v_level:='medium';
  end if;

  insert into public.risk_assessments(order_id,score,level,status,reasons,model_version)
  values(p_order_id,v_score,v_level,v_status,v_reasons,'rules-v1')
  on conflict(order_id) do update
    set score=excluded.score,
        level=excluded.level,
        status=case when public.risk_assessments.status in ('approved','blocked')
                    then public.risk_assessments.status else excluded.status end,
        reasons=excluded.reasons,
        model_version=excluded.model_version;

  return jsonb_build_object(
    'score',v_score,'level',v_level,
    'status',coalesce((select status from public.risk_assessments where order_id=p_order_id),v_status),
    'reasons',v_reasons,'modelVersion','rules-v1'
  );
end;
$$;

create or replace function public.assess_order_risk(p_order_id uuid)
returns jsonb language plpgsql security invoker
set search_path='public','private','pg_temp'
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
  where id=p_order_id and (buyer_id=(select auth.uid()) or seller_id=(select auth.uid()))
  for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  return private.assess_order_risk(v_order.id,v_order.buyer_id,v_order.total);
end;
$$;

revoke execute on function public.assess_order_risk(uuid) from public,anon;
grant execute on function public.assess_order_risk(uuid) to authenticated;

create or replace function public.admin_review_risk(
  p_assessment_id uuid,p_status text,p_note text
)
returns jsonb language plpgsql security invoker
set search_path='public','private','pg_temp'
as $$
declare v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_status not in ('approved','blocked') then raise exception 'Invalid risk review status' using errcode='22023'; end if;

  update public.risk_assessments
  set status=p_status,reviewed_by=(select auth.uid()),reviewed_at=now(),
      review_note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_assessment_id
  returning id into v_id;

  if v_id is null then raise exception 'Risk assessment not found' using errcode='P0002'; end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data)
  values((select auth.uid()),'risk.reviewed','risk_assessment',v_id,
         jsonb_build_object('status',p_status,'note',p_note));

  return jsonb_build_object('assessment_id',v_id,'status',p_status);
end;
$$;

revoke execute on function public.admin_review_risk(uuid,text,text) from public,anon;
grant execute on function public.admin_review_risk(uuid,text,text) to authenticated;

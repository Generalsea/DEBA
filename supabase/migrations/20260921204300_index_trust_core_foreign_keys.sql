-- Cover every newly introduced trust/transaction foreign key with a dedicated index.

create index if not exists dispute_messages_author_id_idx
  on public.dispute_messages(author_id);

create index if not exists disputes_raised_by_idx
  on public.disputes(raised_by);

create index if not exists disputes_resolved_by_idx
  on public.disputes(resolved_by);

create index if not exists order_status_history_actor_id_idx
  on public.order_status_history(actor_id);

create index if not exists refunds_created_by_idx
  on public.refunds(created_by);

create index if not exists refunds_order_id_idx
  on public.refunds(order_id);

create index if not exists reviews_order_id_idx
  on public.reviews(order_id);

create index if not exists reviews_order_item_id_idx
  on public.reviews(order_item_id);

create index if not exists support_messages_author_id_idx
  on public.support_messages(author_id);

create index if not exists support_tickets_assigned_to_idx
  on public.support_tickets(assigned_to);

create index if not exists support_tickets_order_id_idx
  on public.support_tickets(order_id);

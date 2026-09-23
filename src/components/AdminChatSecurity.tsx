import { AlertTriangle, Fingerprint, MessageCircle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'

type SecurityEvent = {
  id: string
  room_id: string
  message_id: string | null
  user_id: string
  ip_address: string | null
  mac_address: string | null
  email_snapshot: string | null
  phone_snapshot: string | null
  user_agent: string | null
  accept_language: string | null
  metadata: { risk_flags?: unknown } | null
  created_at: string
}

type MessageRow = { id: string; body: string | null }

type ProfileRow = { id: string; display_name: string }

export default async function AdminChatSecurity() {
  const supabase = await createClient()
  const { data: events, error } = await supabase
    .from('chat_security_events')
    .select('id,room_id,message_id,user_id,ip_address,mac_address,email_snapshot,phone_snapshot,user_agent,accept_language,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) {
    return (
      <section className="deba-admin-chat-security">
        <div className="deba-admin-chat-head">
          <div><ShieldCheck size={20} /><div><span>CHAT SAFETY</span><h2>أرشيف حماية المحادثات</h2></div></div>
        </div>
        <div className="deba-admin-chat-empty"><AlertTriangle size={20} />تعذر قراءة سجل حماية المحادثات.</div>
      </section>
    )
  }

  const rows = (events || []) as SecurityEvent[]
  const messageIds = rows.map((row) => row.message_id).filter((id): id is string => Boolean(id))
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)))
  const [{ data: messages }, { data: profiles }] = await Promise.all([
    messageIds.length ? supabase.from('messages').select('id,body').in('id', messageIds) : Promise.resolve({ data: [] as MessageRow[] }),
    userIds.length ? supabase.from('profiles').select('id,display_name').in('id', userIds) : Promise.resolve({ data: [] as ProfileRow[] }),
  ])
  const messageMap = new Map((messages || []).map((message) => [message.id, message]))
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))

  return (
    <section className="deba-admin-chat-security">
      <div className="deba-admin-chat-head">
        <div>
          <span>CHAT SAFETY / AUDIT</span>
          <h2>أرشيف حماية المحادثات</h2>
          <p>سجل داخلي لإشارات السلامة المرتبطة بالرسائل، للاستخدام في مكافحة الاحتيال والتحقيق في البلاغات.</p>
        </div>
        <div className="deba-admin-chat-count"><MessageCircle size={17} /><strong>{rows.length}</strong><span>آخر سجل</span></div>
      </div>

      {rows.length ? (
        <div className="deba-admin-chat-table-wrap">
          <table className="deba-admin-chat-table">
            <thead>
              <tr>
                <th>العضو</th>
                <th>الرسالة</th>
                <th>إشارات السلامة</th>
                <th>IP</th>
                <th>البريد</th>
                <th>الهاتف</th>
                <th>MAC</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const flags = Array.isArray(row.metadata?.risk_flags) ? row.metadata?.risk_flags.join(' · ') : ''
                return (
                  <tr key={row.id}>
                    <td><strong>{profileMap.get(row.user_id)?.display_name || 'عضو DEBA'}</strong></td>
                    <td><span className="deba-admin-chat-message">{row.message_id ? (messageMap.get(row.message_id)?.body || '—') : '—'}</span></td>
                    <td><span className={'deba-admin-chat-flags' + (flags ? ' risk' : '')}>{flags || 'طبيعي'}</span></td>
                    <td dir="ltr">{row.ip_address || '—'}</td>
                    <td dir="ltr">{row.email_snapshot || '—'}</td>
                    <td dir="ltr">{row.phone_snapshot || '—'}</td>
                    <td>{row.mac_address || 'غير متاح من الويب'}</td>
                    <td>{new Intl.DateTimeFormat('ar-EG', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.created_at))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="deba-admin-chat-empty"><Fingerprint size={23} /><span>لا توجد أحداث شات مسجلة حتى الآن.</span></div>
      )}

      <footer className="deba-admin-chat-foot">
        لا يقرأ DEBA عنوان MAC من متصفح الويب؛ الحقل يبقى فارغًا في جلسات الويب ويصبح قابلًا للتغذية فقط من عميل موثوق يملك إذنًا صريحًا لذلك.
      </footer>
    </section>
  )
}

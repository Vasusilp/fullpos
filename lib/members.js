import bcrypt from 'bcryptjs';

const MAX_FAILS = 5;
const LOCK_MIN = 15;

// ตรวจเบอร์ + PIN; คืนสมาชิกถ้าถูกต้อง. ใช้ร่วมกับ /api/customer-order
export async function verifyMember(sb, phone, pin) {
  const { data: m } = await sb.from('members').select('*').eq('phone', phone).maybeSingle();
  if (!m || !m.is_active) return { error: 'invalid_credentials', status: 401 };
  if (m.locked_until && new Date(m.locked_until) > new Date()) return { error: 'locked', status: 423 };

  const ok = await bcrypt.compare(String(pin), m.pin_hash);
  if (!ok) {
    const fails = m.failed_pin_attempts + 1;
    const patch = fails >= MAX_FAILS
      ? { failed_pin_attempts: 0, locked_until: new Date(Date.now() + LOCK_MIN * 60_000).toISOString() }
      : { failed_pin_attempts: fails };
    await sb.from('members').update(patch).eq('id', m.id);
    return { error: fails >= MAX_FAILS ? 'locked' : 'invalid_credentials', status: fails >= MAX_FAILS ? 423 : 401 };
  }
  if (m.failed_pin_attempts > 0 || m.locked_until) {
    await sb.from('members').update({ failed_pin_attempts: 0, locked_until: null }).eq('id', m.id);
  }
  return { member: m };
}


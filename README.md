# POS Pearl — Quick Service POS + ระบบสมาชิก + RBAC

Next.js 14 (App Router, JavaScript) + Tailwind + Zustand + Supabase (Auth/Postgres/Realtime/Storage) — deploy บน Vercel

## เริ่มใช้งาน

1. สร้างโปรเจกต์ Supabase แล้วเปิด SQL Editor รันไฟล์ `supabase/schema.sql` ทั้งไฟล์
   (ตาราง, RPC `place_order` / `confirm_qr_payment` / `cancel_order` / `adjust_points`, RLS, view `members_public`, Realtime, Storage bucket `product-images`, ข้อมูลตัวอย่าง)
2. สร้างผู้ใช้ใน Authentication > Users แล้วรัน (ใส่ uuid ของผู้ใช้):
   ```sql
   insert into profiles (id, full_name, email, role)
   values ('<auth-user-uuid>', 'Owner', 'owner@example.com', 'admin');
   ```
3. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า (`SUPABASE_SERVICE_ROLE_KEY` ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
4. `npm install` แล้ว `npm run dev` → http://localhost:3000
5. Deploy: push ขึ้น GitHub → Import เข้า Vercel → ตั้ง Environment Variables 4 ตัวใน `.env.example` → ตั้ง Site URL ใน Supabase Auth ให้ตรงโดเมน

## หน้าต่าง ๆ

| Route | ใครใช้ | หมายเหตุ |
|---|---|---|
| `/login` | พนักงาน | Email + Password |
| `/pos` `/checker` `/orders` `/products` `/settings` | Staff + Admin | Staff เห็นออเดอร์เฉพาะวันนี้ และสินค้าแบบอ่านอย่างเดียว |
| `/members` `/reports` `/staff` `/admin/audit` | Admin เท่านั้น | กันด้วย UI + `middleware.js` + RLS |
| `/order` `/register` `/member` | ลูกค้า (มือถือ) | QR หน้าร้านชี้ไป `/order` และ `/register` |
| `/queue?token=<QUEUE_DISPLAY_TOKEN>` | จอทีวี | ไม่ต้องล็อกอิน คืนเฉพาะเลขคิว |

## ข้อควรรู้

- **ราคา/ส่วนลด/แต้ม คำนวณซ้ำใน DB ทุกครั้ง** (`_build_order`) — ค่าที่ Zustand คำนวณใช้แสดงผลเท่านั้น
- แต้มสะสม/ใช้จริงตอน "ชำระแล้ว": หน้าเคาน์เตอร์ทันที, ออเดอร์ QR เมื่อพนักงานกดยืนยันชำระ
- ลูกค้า `/order` กรอกเบอร์อย่างเดียว = สะสมแต้ม; กรอก PIN ด้วย = ใช้แต้มได้ (PIN ผิด 5 ครั้งล็อก 15 นาที)
- `pin_hash` ถูกถอดสิทธิ์อ่านจาก client (column-level) และเข้าถึงผ่าน Service Role ใน API Route เท่านั้น
- Rate limit เป็นแบบ in-memory ต่อ instance (`lib/rateLimit.js`) — ถ้าต้อง scale หลาย instance ให้เปลี่ยนเป็น Redis/Upstash
- PromptPay ยืนยันโดยพนักงาน ถ้าต้องการอัตโนมัติต้องเชื่อม Payment Gateway เพิ่ม
- เลขคิวรีเซ็ตทุกวันตามเวลา Asia/Bangkok (`today_th()`)
- เสียงแจ้งเตือนใช้ Web Audio API (ไม่ต้องมีไฟล์ .mp3); เบราว์เซอร์อาจต้องให้แตะหน้าจอหนึ่งครั้งก่อนจึงจะเล่นเสียงได้

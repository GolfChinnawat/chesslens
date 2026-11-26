# ร่วมพัฒนา ChessLens

## รันในเครื่อง

ใช้ Node.js ตามเวอร์ชันที่ระบุใน `package.json` แล้วรัน

```bash
npm ci
npm run dev
```

ตรวจงานก่อนเปิด Pull Request

```bash
npm run lint
npm test
npm run build
```

หากแก้ Service Worker ให้ทดสอบจาก production build ตาม [วิธีทดสอบออฟไลน์](docs/OFFLINE.md)
หากแก้ระบบบัญชี ให้ใช้โปรเจกต์ทดสอบของตัวเองและดู [วิธีตั้งค่า Supabase](docs/DEPLOY.md)

## แจ้งบั๊ก

ใช้ [แบบฟอร์มแจ้งบั๊ก](https://github.com/GolfChinnawat/chesslens/issues/new?template=bug_report.yml)
หรือกด **แจ้งบั๊กบน GitHub** ที่หน้าเล่น แล้วกรอกชื่อหน้า ขั้นตอนทำซ้ำ ผลที่คาดหวัง ผลที่พบ และชื่อเบราว์เซอร์
ถ้าปัญหาเกิดตอนวิเคราะห์ ให้ระบุความลึกของ Stockfish และแนบ PGN ตัวอย่างที่เปิดเผยได้
สำหรับปัญหาออนไลน์หรือออฟไลน์ ให้ระบุข้อความทั้งสองบรรทัดที่หน้าเล่นแสดง
โปรดลบอีเมล ข้อมูลล็อกอิน และคีย์ลับออกจากภาพหน้าจอและล็อกก่อนแนบ

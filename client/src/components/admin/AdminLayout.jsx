// ============================================================
// ไฟล์: client/src/components/admin/AdminLayout.jsx
//
// หน้าที่: สร้างโครงหน้าจอที่หน้าแอดมินใช้ร่วมกัน
//   1) แสดงเมนูด้านข้างด้วย AdminSidebar
//   2) สร้างพื้นที่หลักสำหรับแสดงเนื้อหาของแต่ละหน้า
//
// แนวคิด:
//   แต่ละหน้าแอดมินมีเนื้อหาต่างกัน
//   แต่ใช้เมนูด้านข้างและโครงหน้าจอเหมือนกัน
//   จึงเขียนโครงนี้ครั้งเดียว แล้วให้แต่ละหน้านำไปใช้
//
// ตัวอย่างการเรียกใช้:
//   <AdminLayout>
//     <h1>จัดการเอกสาร</h1>
//   </AdminLayout>
//
//   ในตัวอย่างนี้ children คือ <h1>จัดการเอกสาร</h1>
//   ซึ่งจะถูกนำไปแสดงในพื้นที่ admin-content
//
// ถ้าอาจารย์ให้แก้:
//   - โครงหน้าจอแอดมินร่วมกัน → ดูไฟล์นี้
//   - รายการเมนูด้านข้าง → ดู AdminSidebar.jsx
//   - สี ระยะห่าง หรือขนาดพื้นที่ → ดู Admin.css
//   - เนื้อหาของหน้าใดหน้าหนึ่ง → ดูไฟล์ของหน้านั้น
// ============================================================

// นำเข้า component เมนูด้านข้าง
// "./AdminSidebar" หมายถึงไฟล์ AdminSidebar ที่อยู่ในโฟลเดอร์เดียวกัน
import AdminSidebar from "./AdminSidebar";

// โหลด CSS สำหรับจัดหน้าตาและโครงหน้าจอแอดมิน
// ../../ = ย้อนขึ้นไปสองระดับ จากโฟลเดอร์ admin ไปถึง src
// แล้วเข้าไปที่ pages/admin/Admin.css
import "../../pages/admin/Admin.css";

// โครง 3 ชั้น (admin-page > sidebar + admin-main > admin-content) ที่ทุกหน้า
// ในโซน /admin ใช้เหมือนกันหมด — เดิม copy วางซ้ำใน Dashboard, DocumentManagement,
// DocumentChunks, UploadDocument, UserManagement (บางหน้าซ้ำ 2-3 รอบใน early return
// ตอน loading/error ด้วย) รวมมาเป็น component เดียว

// สร้าง React component ชื่อ AdminLayout
//
// React ส่งข้อมูลให้ component ผ่านออบเจ็กต์ที่เรียกว่า props
// { children } = ดึงช่อง children ออกจาก props มาใช้โดยตรง
//
// children = เนื้อหาที่ผู้เรียกใส่ไว้ระหว่าง
// <AdminLayout> และ </AdminLayout>
// อาจเป็นข้อความ element หรือ component หลายตัวก็ได้
function AdminLayout({ children }) {

  // return = คืน JSX ที่ React จะนำไปแสดงบนหน้าจอ
  // วงเล็บ (...) ช่วยให้เขียน JSX หลายบรรทัดได้
  return (

    // div ชั้นนอก ครอบทั้งเมนูด้านข้างและพื้นที่เนื้อหา
    // className = ชื่อคลาสที่ CSS ใช้เลือกส่วนนี้ไปจัดหน้าตา
    <div className="admin-page">

      {/* แสดง component เมนูด้านข้าง
          รูปแบบ <AdminSidebar /> คือเรียก component โดยไม่มีเนื้อหาข้างใน */}
      <AdminSidebar />

      {/* main = พื้นที่เนื้อหาหลักของหน้า
          className="admin-main" เชื่อมกับกฎการจัดหน้าตาใน CSS */}
      <main className="admin-main">

        {/* พื้นที่ใส่เนื้อหาที่แต่ละหน้าส่งเข้ามา
            {children} = นำค่า JavaScript ของ children มาแสดงใน JSX
            เช่น ถ้าเรียกจากหน้าจัดการเอกสาร ตรงนี้จะแสดงเนื้อหาหน้านั้น */}
        <div className="admin-content">{children}</div>

      {/* จบพื้นที่เนื้อหาหลัก */}
      </main>

    {/* จบ div ชั้นนอกที่ครอบทั้งหน้า */}
    </div>

  ); // จบ JSX ที่คืนออกจาก component

} // จบ component AdminLayout

// เปิดให้ไฟล์อื่น import component นี้ไปใช้แบบ default
// เช่น import AdminLayout from "../../components/admin/AdminLayout";
export default AdminLayout;
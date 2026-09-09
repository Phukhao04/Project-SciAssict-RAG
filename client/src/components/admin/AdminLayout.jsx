import AdminSidebar from "./AdminSidebar";
import "../../pages/admin/Admin.css";

// โครง 3 ชั้น (admin-page > sidebar + admin-main > admin-content) ที่ทุกหน้า
// ในโซน /admin ใช้เหมือนกันหมด — เดิม copy วางซ้ำใน Dashboard, DocumentManagement,
// DocumentChunks, UploadDocument, UserManagement (บางหน้าซ้ำ 2-3 รอบใน early return
// ตอน loading/error ด้วย) รวมมาเป็น component เดียว
function AdminLayout({ children }) {
  return (
    <div className="admin-page">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}

export default AdminLayout;

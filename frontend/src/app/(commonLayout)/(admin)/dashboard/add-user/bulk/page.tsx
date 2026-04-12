import AddBulkUsersForm from "@/components/module/admin/AddBulkUser"

const BulkUploadPage = () => {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk Upload Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload an Excel file to create multiple user accounts at once
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3">Excel File Format</h3>
        <p className="text-sm text-amber-900 mb-3">
          Your Excel file should have the following columns:
        </p>
        <ul className="text-sm text-amber-900 space-y-2 ml-4">
          <li><strong>name</strong> - Student/Teacher/CR full name (required)</li>
          <li><strong>email</strong> - Valid email address (required)</li>
          <li><strong>password</strong> - Password (at least 6 characters, required)</li>
          <li><strong>role</strong> - &quot;student&quot;, &quot;teacher&quot;, or &quot;cr&quot; (required)</li>
          <li><strong>batchNumber</strong> - Batch number as number (required only for students)</li>
        </ul>
        <p className="text-sm text-amber-900 mt-3">
          Example: For a student, batchNumber should be a number like 101, 102, etc.
        </p>
      </div>

      <AddBulkUsersForm />
    </div>
  )
}

export default BulkUploadPage
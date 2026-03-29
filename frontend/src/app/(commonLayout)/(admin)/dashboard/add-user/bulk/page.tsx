import AddBulkUsersForm from "@/components/module/admin/AddBulkUser"

const BulkUploadPage = () => {
  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk Upload Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload an Excel file to create multiple user accounts at once
        </p>
      </div>
      <AddBulkUsersForm />
    </div>
  )
}

export default BulkUploadPage
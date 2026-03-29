import AddUserForm from "@/components/module/admin/AddUser"

const AddUserPage = () => {
  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add User</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new student account
        </p>
      </div>
      <AddUserForm />
    </div>
  )
}

export default AddUserPage
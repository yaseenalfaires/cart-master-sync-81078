import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Shield, User as UserIcon } from "lucide-react";
import { formatDate } from "@/lib/formatting";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: "admin" | "cashier" | "manager";
}

const Employees = () => {
  const [employees, setEmployees] = useState<(Profile & { role: string })[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "cashier",
  });

  useEffect(() => {
    checkUser();
    fetchEmployees();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role, user_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      
      setCurrentUser(userRole);
      
      if (userRole?.role !== "admin") {
        toast.error("الوصول مرفوض. للمسؤولين فقط.");
      }
    }
  };

  const fetchEmployees = async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      toast.error("فشل في جلب الموظفين");
      return;
    }

    // Fetch roles for all users
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      toast.error("فشل في جلب الأدوار");
      return;
    }

    // Merge profiles with roles
    const employeesWithRoles = profiles?.map(profile => ({
      ...profile,
      role: roles?.find(r => r.user_id === profile.id)?.role || "cashier"
    })) || [];

    setEmployees(employeesWithRoles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentUser?.role !== "admin") {
      toast.error("المسؤولون فقط يمكنهم إنشاء موظفين");
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: formData.role,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      toast.success(`تم إنشاء الموظف ${formData.fullName} بنجاح!`);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || "فشل في إنشاء الموظف");
    }
  };

  const handleUpdateRole = async (employeeId: string, newRole: "admin" | "cashier" | "manager") => {
    if (currentUser?.role !== "admin") {
      toast.error("المسؤولون فقط يمكنهم تحديث الأدوار");
      return;
    }

    // Delete existing role
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", employeeId);

    // Insert new role
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: employeeId, role: newRole });

    if (error) {
      toast.error("فشل في تحديث الدور");
    } else {
      toast.success("تم تحديث الدور بنجاح");
      fetchEmployees();
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      fullName: "",
      role: "cashier",
    });
    setIsDialogOpen(false);
  };

  const getRoleBadge = (role: string) => {
    const variants: any = {
      admin: "destructive",
      manager: "default",
      cashier: "secondary",
    };
    
    const icons: any = {
      admin: Shield,
      manager: UserIcon,
      cashier: UserIcon,
    };

    const roleNames: any = {
      admin: "مسؤول",
      manager: "مدير",
      cashier: "أمين صندوق",
    };
    
    const Icon = icons[role] || UserIcon;
    
    return (
      <Badge variant={variants[role] || "secondary"} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {roleNames[role]}
      </Badge>
    );
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              الوصول مرفوض. هذه الصفحة متاحة للمسؤولين فقط.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">إدارة الموظفين</h1>
          <p className="text-muted-foreground mt-2">إدارة حسابات الموظفين والأدوار</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء موظف جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور المؤقتة</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">الدور</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">أمين صندوق</SelectItem>
                    <SelectItem value="manager">مدير</SelectItem>
                    <SelectItem value="admin">مسؤول</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
                <Button type="submit">إنشاء موظف</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>جميع الموظفين</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>تاريخ الانضمام</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.full_name}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{getRoleBadge(employee.role)}</TableCell>
                  <TableCell>{formatDate(employee.created_at)}</TableCell>
                  <TableCell className="text-left">
                    <Select
                      value={employee.role}
                      onValueChange={(value) => handleUpdateRole(employee.id, value as "admin" | "cashier" | "manager")}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashier">أمين صندوق</SelectItem>
                        <SelectItem value="manager">مدير</SelectItem>
                        <SelectItem value="admin">مسؤول</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Employees;

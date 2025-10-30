import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatNumber, formatDate } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paid: boolean;
  recurring: boolean;
}

const Expenses = () => {
  const { currency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: "rent",
    description: "",
    amount: "",
    paid: false,
    recurring: false,
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      toast.error("فشل في جلب المصروفات");
    } else {
      setExpenses(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const expenseData = {
      date: formData.date,
      category: formData.category as any,
      description: formData.description,
      amount: parseFloat(formData.amount),
      paid: formData.paid,
      recurring: formData.recurring,
    };

    const { error } = await supabase
      .from("expenses")
      .insert(expenseData);

    if (error) {
      toast.error("فشل في إضافة المصروف");
    } else {
      toast.success("تمت إضافة المصروف بنجاح");
      resetForm();
      fetchExpenses();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المصروف؟")) return;

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("فشل في حذف المصروف");
    } else {
      toast.success("تم حذف المصروف بنجاح");
      fetchExpenses();
    }
  };

  const togglePaid = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("expenses")
      .update({ paid: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("فشل في تحديث المصروف");
    } else {
      fetchExpenses();
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: "rent",
      description: "",
      amount: "",
      paid: false,
      recurring: false,
    });
    setIsDialogOpen(false);
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const unpaidExpenses = expenses.filter(exp => !exp.paid).reduce((sum, exp) => sum + Number(exp.amount), 0);

  const categoryNames: any = {
    rent: "الإيجار",
    utilities: "المرافق",
    internet: "الإنترنت",
    salaries: "الرواتب",
    inventory: "المخزون",
    maintenance: "الصيانة",
    other: "أخرى"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">المصروفات</h1>
          <p className="text-muted-foreground mt-2">تتبع وإدارة المصروفات</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              إضافة مصروف
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مصروف جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">التاريخ</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">الفئة</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">الإيجار</SelectItem>
                    <SelectItem value="utilities">المرافق</SelectItem>
                    <SelectItem value="internet">الإنترنت</SelectItem>
                    <SelectItem value="salaries">الرواتب</SelectItem>
                    <SelectItem value="inventory">المخزون</SelectItem>
                    <SelectItem value="maintenance">الصيانة</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2 gap-2">
                <Checkbox
                  id="paid"
                  checked={formData.paid}
                  onCheckedChange={(checked) => setFormData({ ...formData, paid: checked as boolean })}
                />
                <Label htmlFor="paid">مدفوع</Label>
              </div>
              <div className="flex items-center space-x-2 gap-2">
                <Checkbox
                  id="recurring"
                  checked={formData.recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, recurring: checked as boolean })}
                />
                <Label htmlFor="recurring">متكرر</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
                <Button type="submit">إضافة مصروف</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>إجمالي المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalExpenses, currency)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>المصروفات غير المدفوعة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{formatCurrency(unpaidExpenses, currency)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>سجل المصروفات</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>متكرر</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell>{categoryNames[expense.category]}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(Number(expense.amount), currency)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={expense.paid ? "default" : "outline"}
                      onClick={() => togglePaid(expense.id, expense.paid)}
                    >
                      {expense.paid ? "مدفوع" : "غير مدفوع"}
                    </Button>
                  </TableCell>
                  <TableCell>{expense.recurring ? "نعم" : "لا"}</TableCell>
                  <TableCell className="text-left">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(expense.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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

export default Expenses;

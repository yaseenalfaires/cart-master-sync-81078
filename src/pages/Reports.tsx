import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { formatCurrency, formatDate, formatTime, formatNumber } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  profiles: {
    full_name: string;
  };
}

interface SaleRecord {
  id: string;
  created_at: string;
  total: number;
  payment_method: string;
  employee_id: string;
  profiles: {
    full_name: string;
  };
}

const Reports = () => {
  const { currency } = useCurrency();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch attendance data
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select(`
          *,
          profiles:employee_id(full_name)
        `)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (attendanceError) throw attendanceError;

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(`
          *,
          profiles:employee_id(full_name)
        `)
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (salesError) throw salesError;

      setAttendance(attendanceData || []);
      setSales(salesData || []);
      toast.success("تم تحميل البيانات");
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("فشل في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const printReport = () => {
    const totalHours = attendance.reduce((sum, record) => sum + (record.hours_worked || 0), 0);
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);

    const reportContent = `
      <html dir="rtl">
        <head>
          <title>تقرير الورديات والمبيعات</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
            h2 { margin-top: 30px; border-bottom: 1px solid #666; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; }
            .summary-item { margin: 10px 0; font-size: 16px; }
            .date-range { text-align: center; margin: 10px 0; color: #666; }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <h1>تقرير الورديات والمبيعات</h1>
          <div class="date-range">
            من ${formatDate(startDate)} إلى ${formatDate(endDate)}
          </div>

          <h2>ملخص عام</h2>
          <div class="summary">
            <div class="summary-item"><strong>إجمالي ساعات العمل:</strong> ${formatNumber(totalHours, 2)} ساعة</div>
            <div class="summary-item"><strong>إجمالي المبيعات:</strong> ${formatCurrency(totalSales, currency)}</div>
            <div class="summary-item"><strong>عدد العمليات:</strong> ${sales.length}</div>
            <div class="summary-item"><strong>عدد الورديات:</strong> ${attendance.length}</div>
          </div>

          <h2>تفاصيل الحضور</h2>
          <table>
            <thead>
              <tr>
                <th>الموظف</th>
                <th>التاريخ</th>
                <th>وقت الدخول</th>
                <th>وقت الخروج</th>
                <th>ساعات العمل</th>
              </tr>
            </thead>
            <tbody>
              ${attendance.map(record => `
                <tr>
                  <td>${record.profiles.full_name}</td>
                  <td>${formatDate(record.date)}</td>
                  <td>${formatTime(record.clock_in)}</td>
                  <td>${record.clock_out ? formatTime(record.clock_out) : 'لم يسجل الخروج'}</td>
                  <td>${record.hours_worked ? formatNumber(record.hours_worked, 2) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>تفاصيل المبيعات</h2>
          <table>
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>الموظف</th>
                <th>طريقة الدفع</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${sales.map(sale => `
                <tr>
                  <td>${formatDate(sale.created_at)} ${formatTime(sale.created_at)}</td>
                  <td>${sale.profiles.full_name}</td>
                  <td>${sale.payment_method === 'cash' ? 'نقداً' : sale.payment_method === 'credit_card' ? 'بطاقة ائتمان' : 'بطاقة مدين'}</td>
                  <td>${formatCurrency(sale.total, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-item">تم إنشاء التقرير في: ${formatDate(new Date().toISOString())} ${formatTime(new Date().toISOString())}</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=1000,height=800');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">التقارير</h1>
        <p className="text-muted-foreground mt-2">تقارير الورديات والمبيعات</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>فترة التقرير</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">من تاريخ</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">إلى تاريخ</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchReportData} disabled={loading} className="flex-1">
              {loading ? "جاري التحميل..." : "تحديث البيانات"}
            </Button>
            <Button onClick={printReport} variant="outline" disabled={loading || (attendance.length === 0 && sales.length === 0)}>
              <Printer className="w-4 h-4 ml-2" />
              طباعة التقرير
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>ملخص الحضور</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>إجمالي الورديات:</span>
                <span className="font-bold">{attendance.length}</span>
              </div>
              <div className="flex justify-between">
                <span>إجمالي الساعات:</span>
                <span className="font-bold">
                  {formatNumber(attendance.reduce((sum, r) => sum + (r.hours_worked || 0), 0), 2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>ملخص المبيعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>عدد العمليات:</span>
                <span className="font-bold">{sales.length}</span>
              </div>
              <div className="flex justify-between">
                <span>إجمالي المبيعات:</span>
                <span className="font-bold">
                  {formatCurrency(sales.reduce((sum, s) => sum + s.total, 0), currency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;

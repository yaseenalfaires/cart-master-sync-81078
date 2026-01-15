import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { formatCurrency, formatDate, formatTime, formatNumber } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { format, parseISO, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { ar } from "date-fns/locale";

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

interface SaleItemRecord {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price_at_sale: number;
  size: string | null;
  products: {
    name: string;
    category: string;
    color: string;
    cost_price: number | null;
  };
}

type TimeGrouping = "day" | "week" | "month";
type PieChartView = "category" | "color" | "size";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
];

const Reports = () => {
  const { currency } = useCurrency();
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>("day");
  const [pieChartView, setPieChartView] = useState<PieChartView>("category");

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch attendance data
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select(
          `
          *,
          profiles:employee_id(full_name)
        `
        )
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (attendanceError) throw attendanceError;

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(
          `
          *,
          profiles:employee_id(full_name)
        `
        )
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (salesError) throw salesError;

      // Fetch sale items with product details
      const { data: saleItemsData, error: saleItemsError } = await supabase
        .from("sale_items")
        .select(
          `
          *,
          products:product_id(name, category, color, cost_price)
        `
        )
        .in(
          "sale_id",
          (salesData || []).map((s) => s.id)
        );

      if (saleItemsError) throw saleItemsError;

      setAttendance(attendanceData || []);
      setSales(salesData || []);
      setSaleItems(saleItemsData || []);
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

  // Generate time-based chart data
  const generateTimeChartData = () => {
    if (sales.length === 0) return [];

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    let intervals: Date[];
    let formatPattern: string;

    switch (timeGrouping) {
      case "week":
        intervals = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });
        formatPattern = "yyyy/MM/dd";
        break;
      case "month":
        intervals = eachMonthOfInterval({ start, end });
        formatPattern = "yyyy/MM";
        break;
      default:
        intervals = eachDayOfInterval({ start, end });
        formatPattern = "MM/dd";
    }

    return intervals.map((intervalStart) => {
      let intervalEnd: Date;
      switch (timeGrouping) {
        case "week":
          intervalEnd = new Date(intervalStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
          break;
        case "month":
          intervalEnd = new Date(intervalStart.getFullYear(), intervalStart.getMonth() + 1, 0, 23, 59, 59);
          break;
        default:
          intervalEnd = new Date(intervalStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      }

      const periodSales = sales.filter((sale) => {
        const saleDate = parseISO(sale.created_at);
        return saleDate >= intervalStart && saleDate <= intervalEnd;
      });

      const periodSaleIds = periodSales.map((s) => s.id);
      const periodItems = saleItems.filter((item) => periodSaleIds.includes(item.sale_id));

      const totalRevenue = periodSales.reduce((sum, sale) => sum + sale.total, 0);
      const totalCost = periodItems.reduce((sum, item) => {
        const costPrice = item.products?.cost_price || 0;
        return sum + costPrice * item.quantity;
      }, 0);
      const profit = totalRevenue - totalCost;

      return {
        date: format(intervalStart, formatPattern, { locale: ar }),
        المبيعات: totalRevenue,
        الأرباح: profit,
        transactions: periodSales.length,
      };
    });
  };

  // Generate pie chart data based on view
  const generatePieChartData = () => {
    if (saleItems.length === 0) return [];

    const groupedData: Record<string, { revenue: number; cost: number }> = {};

    saleItems.forEach((item) => {
      let key: string;
      switch (pieChartView) {
        case "color":
          key = item.products?.color || "غير محدد";
          break;
        case "size":
          key = item.size || "غير محدد";
          break;
        default:
          key = item.products?.category || "غير محدد";
      }

      if (!groupedData[key]) {
        groupedData[key] = { revenue: 0, cost: 0 };
      }

      const revenue = item.price_at_sale * item.quantity;
      const cost = (item.products?.cost_price || 0) * item.quantity;
      groupedData[key].revenue += revenue;
      groupedData[key].cost += cost;
    });

    return Object.entries(groupedData)
      .map(([name, data]) => ({
        name,
        value: data.revenue - data.cost,
        revenue: data.revenue,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const timeChartData = generateTimeChartData();
  const pieChartData = generatePieChartData();

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = saleItems.reduce((sum, item) => {
    return sum + (item.products?.cost_price || 0) * item.quantity;
  }, 0);
  const totalProfit = totalSales - totalCost;

  const printReport = () => {
    const totalHours = attendance.reduce(
      (sum, record) => sum + (record.hours_worked || 0),
      0
    );

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
            <div class="summary-item"><strong>إجمالي الأرباح:</strong> ${formatCurrency(totalProfit, currency)}</div>
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
              ${attendance
                .map(
                  (record) => `
                <tr>
                  <td>${record.profiles.full_name}</td>
                  <td>${formatDate(record.date)}</td>
                  <td>${formatTime(record.clock_in)}</td>
                  <td>${record.clock_out ? formatTime(record.clock_out) : "لم يسجل الخروج"}</td>
                  <td>${record.hours_worked ? formatNumber(record.hours_worked, 2) : "-"}</td>
                </tr>
              `
                )
                .join("")}
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
              ${sales
                .map(
                  (sale) => `
                <tr>
                  <td>${formatDate(sale.created_at)} ${formatTime(sale.created_at)}</td>
                  <td>${sale.profiles.full_name}</td>
                  <td>${sale.payment_method === "cash" ? "نقداً" : sale.payment_method === "credit_card" ? "بطاقة ائتمان" : "بطاقة مدين"}</td>
                  <td>${formatCurrency(sale.total, currency)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-item">تم إنشاء التقرير في: ${formatDate(new Date().toISOString())} ${formatTime(new Date().toISOString())}</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "", "width=1000,height=800");
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value, currency)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            الربح: {formatCurrency(data.value, currency)}
          </p>
          <p className="text-sm text-muted-foreground">
            الإيرادات: {formatCurrency(data.revenue, currency)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">التقارير</h1>
        <p className="text-muted-foreground mt-2">
          تقارير الورديات والمبيعات مع الرسوم البيانية
        </p>
      </div>

      {/* Date Range Selection */}
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
            <Button
              onClick={fetchReportData}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "جاري التحميل..." : "تحديث البيانات"}
            </Button>
            <Button
              onClick={printReport}
              variant="outline"
              disabled={loading || (attendance.length === 0 && sales.length === 0)}
            >
              <Printer className="w-4 h-4 ml-2" />
              طباعة التقرير
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              إجمالي المبيعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSales, currency)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              إجمالي الأرباح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalProfit, currency)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              عدد العمليات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sales.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ساعات العمل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(
                attendance.reduce((sum, r) => sum + (r.hours_worked || 0), 0),
                2
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales & Profit Chart */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <CardTitle>المبيعات والأرباح عبر الزمن</CardTitle>
          </div>
          <Select
            value={timeGrouping}
            onValueChange={(value: TimeGrouping) => setTimeGrouping(value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">يومي</SelectItem>
              <SelectItem value="week">أسبوعي</SelectItem>
              <SelectItem value="month">شهري</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {timeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={timeChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="المبيعات"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="الأرباح"
                  fill="hsl(var(--chart-2))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              لا توجد بيانات للعرض
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profit Line Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <CardTitle>اتجاه الأرباح</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {timeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="الأرباح"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-2))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              لا توجد بيانات للعرض
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pie Chart */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            <CardTitle>توزيع الأرباح</CardTitle>
          </div>
          <Select
            value={pieChartView}
            onValueChange={(value: PieChartView) => setPieChartView(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">حسب الفئة</SelectItem>
              <SelectItem value="color">حسب اللون</SelectItem>
              <SelectItem value="size">حسب المقاس</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {pieChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {pieChartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              لا توجد بيانات للعرض
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Summary Cards */}
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
                  {formatNumber(
                    attendance.reduce((sum, r) => sum + (r.hours_worked || 0), 0),
                    2
                  )}
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
                  {formatCurrency(totalSales, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>إجمالي التكلفة:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(totalCost, currency)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>صافي الربح:</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(totalProfit, currency)}
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

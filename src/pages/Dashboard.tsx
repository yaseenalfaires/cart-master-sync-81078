import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatNumber } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  lowStockItems: number;
  totalRevenue: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    lowStockItems: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch today's sales
      const { data: todaySalesData } = await supabase
        .from("sales")
        .select("total")
        .gte("created_at", today.toISOString());

      const todaySales = todaySalesData?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
      const todayOrders = todaySalesData?.length || 0;

      // Fetch total revenue
      const { data: allSalesData } = await supabase
        .from("sales")
        .select("total");

      const totalRevenue = allSalesData?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;

      // Fetch low stock items (stock < 10)
      const { data: lowStockData } = await supabase
        .from("products")
        .select("id")
        .lt("stock", 10);

      const lowStockItems = lowStockData?.length || 0;

      setStats({
        todaySales,
        todayOrders,
        lowStockItems,
        totalRevenue,
      });
    } catch (error) {
      console.error("خطأ في جلب بيانات لوحة التحكم:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "مبيعات اليوم",
      value: formatCurrency(stats.todaySales, currency),
      description: `${formatNumber(stats.todayOrders, 0)} طلب اليوم`,
      icon: DollarSign,
      gradient: "gradient-primary",
    },
    {
      title: "إجمالي الإيرادات",
      value: formatCurrency(stats.totalRevenue, currency),
      description: "جميع المبيعات",
      icon: TrendingUp,
      gradient: "gradient-accent",
    },
    {
      title: "تنبيه المخزون",
      value: formatNumber(stats.lowStockItems, 0),
      description: "منتجات أقل من ١٠ وحدات",
      icon: Package,
      gradient: "gradient-primary",
    },
    {
      title: "الطلبات",
      value: formatNumber(stats.todayOrders, 0),
      description: "مكتملة اليوم",
      icon: ShoppingCart,
      gradient: "gradient-accent",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-2">
          نظرة عامة على أداء متجرك
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="shadow-card transition-smooth hover:shadow-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.gradient}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? "..." : stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card cursor-pointer transition-smooth hover:shadow-elevated" onClick={() => navigate("/pos")}>
          <CardHeader>
            <CardTitle>نقطة البيع</CardTitle>
            <CardDescription>
              معالجة معاملات العملاء وإدارة السلات
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-card cursor-pointer transition-smooth hover:shadow-elevated" onClick={() => navigate("/products")}>
          <CardHeader>
            <CardTitle>إدارة المخزون</CardTitle>
            <CardDescription>
              إدارة المنتجات ومستويات المخزون والفئات
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-card cursor-pointer transition-smooth hover:shadow-elevated" onClick={() => navigate("/expenses")}>
          <CardHeader>
            <CardTitle>المصروفات والمحاسبة</CardTitle>
            <CardDescription>
              تتبع المصروفات وعرض التقارير المالية
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-card cursor-pointer transition-smooth hover:shadow-elevated" onClick={() => navigate("/attendance")}>
          <CardHeader>
            <CardTitle>تتبع الوقت</CardTitle>
            <CardDescription>
              تسجيل الحضور والانصراف وعرض سجلات الحضور
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

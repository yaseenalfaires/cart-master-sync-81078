import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  DollarSign, 
  Clock, 
  LogOut,
  Store,
  Users,
  FileText
} from "lucide-react";
import { OnlineStatus } from "@/components/OnlineStatus";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchUserRole = async (userId: string) => {
      try {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (mounted) setUserRole(userRole?.role || null);
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (mounted) setUserRole(null);
      }
    };
    
    // Set up auth state listener (sync only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer any Supabase calls outside callback
        setTimeout(() => fetchUserRole(session.user!.id), 0);
      } else {
        setUserRole(null);
      }
      
      if (event === 'SIGNED_OUT') {
        navigate('/auth');
      } else if (event === 'SIGNED_IN' && location.pathname === '/auth') {
        navigate('/');
      }
    });

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted) {
        console.error("Session check timeout");
        setLoading(false);
        if (location.pathname !== '/auth') {
          navigate('/auth');
        }
      }
    }, 10000);

    // Check for existing session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        clearTimeout(timeout);
        setSession(session ?? null);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserRole(session.user.id);
        }
        setLoading(false);
        if (!session && location.pathname !== '/auth') {
          navigate('/auth');
        }
      })
      .catch((error) => {
        console.error("Error getting session:", error);
        if (mounted) {
          clearTimeout(timeout);
          setLoading(false);
          navigate('/auth');
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج بنجاح");
    navigate("/auth");
  };

  const navigation = [
    { name: "لوحة التحكم", path: "/", icon: LayoutDashboard, adminOnly: false },
    { name: "نقطة البيع", path: "/pos", icon: ShoppingCart, adminOnly: false },
    { name: "المنتجات", path: "/products", icon: Package, adminOnly: false },
    { name: "المصروفات", path: "/expenses", icon: DollarSign, adminOnly: false },
    { name: "الحضور", path: "/attendance", icon: Clock, adminOnly: false },
    { name: "التقارير", path: "/reports", icon: FileText, adminOnly: false },
    { name: "الموظفون", path: "/employees", icon: Users, adminOnly: true },
  ].filter(item => !item.adminOnly || userRole === "admin");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">مدير المتجر</h1>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <OnlineStatus />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <nav className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? "default" : "ghost"}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Button>
            );
          })}
        </nav>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

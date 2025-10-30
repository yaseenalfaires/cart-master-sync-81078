import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, LogIn, LogOut } from "lucide-react";
import { formatTime, formatDate, formatNumber } from "@/lib/formatting";

interface AttendanceRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  date: string;
}

const Attendance = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentRecord, setCurrentRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAttendance();
    checkCurrentShift();
  }, []);

  const fetchAttendance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", user.id)
      .order("clock_in", { ascending: false })
      .limit(20);

    if (error) {
      toast.error("فشل في جلب سجلات الحضور");
    } else {
      setRecords(data || []);
    }
  };

  const checkCurrentShift = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", user.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .single();

    setCurrentRecord(data);
  };

  const handleClockIn = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("غير مصرح");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("attendance")
      .insert({
        employee_id: user.id,
        clock_in: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      });

    if (error) {
      toast.error("فشل تسجيل الحضور");
    } else {
      toast.success("تم تسجيل الحضور بنجاح!");
      fetchAttendance();
      checkCurrentShift();
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!currentRecord) return;

    setLoading(true);
    const { error } = await supabase
      .from("attendance")
      .update({
        clock_out: new Date().toISOString(),
      })
      .eq("id", currentRecord.id);

    if (error) {
      toast.error("فشل تسجيل الانصراف");
    } else {
      toast.success("تم تسجيل الانصراف بنجاح!");
      fetchAttendance();
      setCurrentRecord(null);
    }
    setLoading(false);
  };

  const formatTimeDisplay = (timestamp: string) => {
    return formatTime(timestamp);
  };

  const formatDateDisplay = (timestamp: string) => {
    return formatDate(timestamp);
  };

  const totalHours = records
    .filter(r => r.hours_worked)
    .reduce((sum, r) => sum + (r.hours_worked || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">تتبع الوقت</h1>
        <p className="text-muted-foreground mt-2">إدارة حضورك</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              تسجيل الحضور/الانصراف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentRecord ? (
              <div className="space-y-4">
                <div className="p-4 bg-accent/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">تم تسجيل الحضور حالياً</p>
                  <p className="text-2xl font-bold">
                    {formatTimeDisplay(currentRecord.clock_in)}
                  </p>
                </div>
                <Button
                  onClick={handleClockOut}
                  disabled={loading}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <LogOut className="w-4 h-4 ml-2" />
                  تسجيل الانصراف
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">لم يتم تسجيل الحضور حالياً</p>
                <Button
                  onClick={handleClockIn}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  <LogIn className="w-4 h-4 ml-2" />
                  تسجيل الحضور
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>إجمالي الساعات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formatNumber(totalHours)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              إجمالي ساعات العمل (آخر ٢٠ سجل)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>سجل الحضور</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>تسجيل الحضور</TableHead>
                <TableHead>تسجيل الانصراف</TableHead>
                <TableHead>ساعات العمل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{formatDateDisplay(record.clock_in)}</TableCell>
                  <TableCell>{formatTimeDisplay(record.clock_in)}</TableCell>
                  <TableCell>
                    {record.clock_out ? formatTimeDisplay(record.clock_out) : "-"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {record.hours_worked ? `${formatNumber(record.hours_worked)} ساعة` : "-"}
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

export default Attendance;

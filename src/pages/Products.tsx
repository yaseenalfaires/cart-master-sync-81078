import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";
import JsBarcode from "jsbarcode";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  barcode: string;
  sku: string;
}

const Products = () => {
  const { currency } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock: "",
    category: "",
    barcode: "",
    sku: "",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      toast.error("فشل في جلب المنتجات");
    } else {
      setProducts(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    if (!formData.name || !formData.price || !formData.stock || !formData.category) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock);

    if (isNaN(price) || price <= 0) {
      toast.error("الرجاء إدخال سعر صحيح");
      return;
    }

    if (isNaN(stock) || stock < 0) {
      toast.error("الرجاء إدخال كمية مخزون صحيحة");
      return;
    }

    const productData = {
      name: formData.name,
      price: price,
      stock: stock,
      category: formData.category,
      barcode: formData.barcode || null,
      sku: formData.sku || null,
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) {
          console.error("Update error:", error);
          toast.error(`فشل في تحديث المنتج: ${error.message}`);
        } else {
          toast.success("تم تحديث المنتج بنجاح");
          resetForm();
          fetchProducts();
        }
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();

        if (error) {
          console.error("Insert error:", error);
          toast.error(`فشل في إنشاء المنتج: ${error.message}`);
        } else {
          toast.success("تم إنشاء المنتج بنجاح");
          
          // Print price tags if quantity is specified and product has barcode
          if (printQuantity > 0 && newProduct.barcode) {
            printPriceTag(newProduct, printQuantity);
          }
          
          resetForm();
          fetchProducts();
        }
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("حدث خطأ غير متوقع");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      barcode: product.barcode || "",
      sku: product.sku || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("فشل في حذف المنتج");
    } else {
      toast.success("تم حذف المنتج بنجاح");
      fetchProducts();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      stock: "",
      category: "",
      barcode: "",
      sku: "",
    });
    setPrintQuantity(1);
    setEditingProduct(null);
    setIsDialogOpen(false);
  };

  const printPriceTag = (product: Product, quantity: number = 1) => {
    if (!product.barcode) {
      toast.error("المنتج لا يحتوي على باركود");
      return;
    }

    // Create a temporary canvas for barcode
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, product.barcode, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true
      });
    } catch (error) {
      toast.error("باركود غير صالح");
      return;
    }
    
    const barcodeImage = canvas.toDataURL();

    const tags = Array(quantity).fill(0).map(() => `
      <div class="price-tag">
        <div class="product-name">${product.name}</div>
        <img src="${barcodeImage}" alt="barcode" class="barcode-img"/>
        <div class="price">${formatCurrency(product.price, currency)}</div>
      </div>
    `).join('');

    const priceTagContent = `
      <html dir="rtl">
        <head>
          <title>بطاقة سعر</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              margin: 0;
            }
            .price-tag { 
              border: 2px solid #000; 
              padding: 20px; 
              display: inline-block; 
              text-align: center;
              margin: 10px;
              page-break-inside: avoid;
              width: 280px;
            }
            .product-name { 
              font-size: 20px; 
              font-weight: bold; 
              margin-bottom: 15px;
              word-wrap: break-word;
            }
            .barcode-img { 
              margin: 10px 0;
              max-width: 100%;
            }
            .price { 
              font-size: 28px; 
              font-weight: bold; 
              color: #000; 
              margin-top: 15px; 
            }
            @media print {
              body { padding: 0; }
              .price-tag { 
                margin: 5mm;
                page-break-after: always;
              }
              .price-tag:last-child {
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          ${tags}
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(priceTagContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">المنتجات</h1>
          <p className="text-muted-foreground mt-2">إدارة المخزون الخاص بك</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" />
              إضافة منتج
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم المنتج</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">السعر</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">المخزون</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">الفئة</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">الباركود</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">رمز المنتج</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>
              {!editingProduct && (
                <div className="space-y-2">
                  <Label htmlFor="printQuantity">عدد الملصقات للطباعة</Label>
                  <Input
                    id="printQuantity"
                    type="number"
                    min="0"
                    value={printQuantity}
                    onChange={(e) => setPrintQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
                <Button type="submit">
                  {editingProduct ? "تحديث" : "إنشاء"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>المخزون</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>المخزون</TableHead>
                <TableHead>الباركود</TableHead>
                <TableHead>رمز المنتج</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{formatCurrency(product.price, currency)}</TableCell>
                  <TableCell>
                    <span className={product.stock < 10 ? "text-destructive font-semibold" : ""}>
                      {formatNumber(product.stock, 0)}
                    </span>
                  </TableCell>
                  <TableCell>{product.barcode || "-"}</TableCell>
                  <TableCell>{product.sku || "-"}</TableCell>
                  <TableCell className="text-left">
                    <div className="flex justify-start gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => printPriceTag(product)}
                        title="طباعة بطاقة السعر"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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

export default Products;

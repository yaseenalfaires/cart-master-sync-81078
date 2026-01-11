import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Printer, Upload, X } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatting";
import { useCurrency } from "@/contexts/CurrencyContext";
import JsBarcode from "jsbarcode";

interface ProductSize {
  id: string;
  product_id: string;
  size: string;
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  stock: number;
  category: string;
  barcode: string;
  sku: string;
  color: string;
  image_url: string | null;
  sizes?: ProductSize[];
}

// Size options based on category
const SIZE_OPTIONS: Record<string, string[]> = {
  "tshirts": ["S", "M", "L", "XL", "XXL"],
  "shirts": ["S", "M", "L", "XL", "XXL"],
  "sweatpants": ["S", "M", "L", "XL", "XXL"],
  "jeans": ["29", "30", "31", "32", "33", "34", "35", "36", "37", "38"],
  "jean_shorts": ["29", "30", "31", "32", "33", "34", "35", "36", "37", "38"],
  "jumpsuits": ["XL", "XXL", "3XL", "4XL"],
  "boxers": ["M", "L", "XL", "XXL"],
  "tanks": ["M", "L", "XL", "XXL"],
  "sneakers": ["40", "41", "42", "43", "44", "45"],
  "shoes": ["40", "41", "42", "43", "44", "45"],
};

const CATEGORY_OPTIONS = [
  { value: "tshirts", label: "تيشرتات" },
  { value: "shirts", label: "قمصان" },
  { value: "sweatpants", label: "بناطيل رياضية" },
  { value: "jeans", label: "جينز" },
  { value: "jean_shorts", label: "شورت جينز" },
  { value: "jumpsuits", label: "جمبسوت" },
  { value: "boxers", label: "بوكسرات" },
  { value: "tanks", label: "فانلات" },
  { value: "sneakers", label: "سنيكرز" },
  { value: "shoes", label: "أحذية" },
];

const Products = () => {
  const { currency } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    name: "",
    cost_price: "",
    selling_price: "",
    category: "",
    barcode: "",
    sku: "",
    color: "",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (productsError) {
      toast.error("فشل في جلب المنتجات");
      return;
    }

    // Fetch sizes for all products
    const { data: sizesData, error: sizesError } = await supabase
      .from("product_sizes")
      .select("*");

    if (sizesError) {
      console.error("Failed to fetch sizes:", sizesError);
    }

    // Map sizes to products
    const productsWithSizes = (productsData || []).map(product => ({
      ...product,
      sizes: (sizesData || []).filter(size => size.product_id === product.id)
    }));

    setProducts(productsWithSizes);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return null;

    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${productId}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, imageFile, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleCategoryChange = (category: string) => {
    setFormData({ ...formData, category });
    // Reset size quantities when category changes
    const sizes = SIZE_OPTIONS[category] || [];
    const newSizeQuantities: Record<string, number> = {};
    sizes.forEach(size => {
      newSizeQuantities[size] = 0;
    });
    setSizeQuantities(newSizeQuantities);
  };

  const calculateTotalStock = () => {
    return Object.values(sizeQuantities).reduce((sum, qty) => sum + qty, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    if (!formData.name || !formData.selling_price || !formData.category || !formData.color) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }

    const sellingPrice = parseFloat(formData.selling_price);
    const costPrice = formData.cost_price ? parseFloat(formData.cost_price) : null;
    const totalStock = calculateTotalStock();

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error("الرجاء إدخال سعر بيع صحيح");
      return;
    }

    if (costPrice !== null && (isNaN(costPrice) || costPrice < 0)) {
      toast.error("الرجاء إدخال سعر تكلفة صحيح");
      return;
    }

    setUploading(true);

    const productData = {
      name: formData.name,
      price: sellingPrice,
      cost_price: costPrice,
      stock: totalStock,
      category: formData.category,
      barcode: formData.barcode || null,
      sku: formData.sku || null,
      color: formData.color,
    };

    try {
      if (editingProduct) {
        let imageUrl = editingProduct.image_url;
        
        if (imageFile) {
          imageUrl = await uploadImage(editingProduct.id);
        }

        const { error } = await supabase
          .from("products")
          .update({ ...productData, image_url: imageUrl })
          .eq("id", editingProduct.id);

        if (error) {
          console.error("Update error:", error);
          toast.error(`فشل في تحديث المنتج: ${error.message}`);
        } else {
          // Update product sizes
          await updateProductSizes(editingProduct.id);
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
          // Upload image if provided
          if (imageFile && newProduct) {
            const imageUrl = await uploadImage(newProduct.id);
            if (imageUrl) {
              await supabase
                .from("products")
                .update({ image_url: imageUrl })
                .eq("id", newProduct.id);
            }
          }

          // Create product sizes
          await createProductSizes(newProduct.id);

          toast.success("تم إنشاء المنتج بنجاح");
          
          // Print price tags if quantity is specified and product has barcode
          if (printQuantity > 0 && newProduct.barcode) {
            printPriceTag({ ...newProduct, sizes: [] }, printQuantity);
          }
          
          resetForm();
          fetchProducts();
        }
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("حدث خطأ غير متوقع");
    } finally {
      setUploading(false);
    }
  };

  const createProductSizes = async (productId: string) => {
    const sizesToInsert = Object.entries(sizeQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([size, quantity]) => ({
        product_id: productId,
        size,
        quantity,
      }));

    if (sizesToInsert.length > 0) {
      const { error } = await supabase
        .from("product_sizes")
        .insert(sizesToInsert);

      if (error) {
        console.error("Error creating sizes:", error);
      }
    }
  };

  const updateProductSizes = async (productId: string) => {
    // Delete existing sizes
    await supabase
      .from("product_sizes")
      .delete()
      .eq("product_id", productId);

    // Create new sizes
    await createProductSizes(productId);

    // Update total stock on product
    const totalStock = calculateTotalStock();
    await supabase
      .from("products")
      .update({ stock: totalStock })
      .eq("id", productId);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      cost_price: product.cost_price?.toString() || "",
      selling_price: product.price.toString(),
      category: product.category,
      barcode: product.barcode || "",
      sku: product.sku || "",
      color: product.color,
    });
    
    // Populate size quantities
    const sizes = SIZE_OPTIONS[product.category] || [];
    const newSizeQuantities: Record<string, number> = {};
    sizes.forEach(size => {
      const existingSize = product.sizes?.find(s => s.size === size);
      newSizeQuantities[size] = existingSize?.quantity || 0;
    });
    setSizeQuantities(newSizeQuantities);
    
    setImagePreview(product.image_url);
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
      cost_price: "",
      selling_price: "",
      category: "",
      barcode: "",
      sku: "",
      color: "",
    });
    setSizeQuantities({});
    setPrintQuantity(1);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  const getCategoryLabel = (value: string) => {
    return CATEGORY_OPTIONS.find(c => c.value === value)?.label || value;
  };

  const getSizesDisplay = (product: Product) => {
    if (!product.sizes || product.sizes.length === 0) {
      return "-";
    }
    return product.sizes
      .filter(s => s.quantity > 0)
      .map(s => `${s.size}: ${s.quantity}`)
      .join(" | ");
  };

  const availableSizes = SIZE_OPTIONS[formData.category] || [];

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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <Label htmlFor="cost_price">سعر التكلفة</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="اختياري"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selling_price">سعر البيع</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    step="0.01"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">الفئة *</Label>
                <Select value={formData.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">اللون *</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="مثال: أحمر، أزرق، أسود"
                  required
                />
              </div>
              
              {availableSizes.length > 0 && (
                <div className="space-y-2">
                  <Label>المقاسات والكميات</Label>
                  <div className="grid grid-cols-5 gap-2 p-4 border rounded-lg bg-muted/30">
                    {availableSizes.map(size => (
                      <div key={size} className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium">{size}</span>
                        <Input
                          type="number"
                          min="0"
                          value={sizeQuantities[size] || 0}
                          onChange={(e) => setSizeQuantities({
                            ...sizeQuantities,
                            [size]: parseInt(e.target.value) || 0
                          })}
                          className="w-16 text-center"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    إجمالي المخزون: {calculateTotalStock()}
                  </p>
                </div>
              )}

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
              <div className="space-y-2">
                <Label>صورة المنتج</Label>
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 ml-2" />
                    اختر صورة
                  </Button>
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="معاينة"
                        className="w-16 h-16 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
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
                <Button type="button" variant="outline" onClick={resetForm} disabled={uploading}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "جاري الحفظ..." : editingProduct ? "تحديث" : "إنشاء"}
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
                <TableHead>الصورة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>اللون</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>المقاسات</TableHead>
                <TableHead>سعر التكلفة</TableHead>
                <TableHead>سعر البيع</TableHead>
                <TableHead>إجمالي المخزون</TableHead>
                <TableHead>الباركود</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                        لا صورة
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.color}</TableCell>
                  <TableCell>{getCategoryLabel(product.category)}</TableCell>
                  <TableCell className="max-w-[200px] text-sm">
                    {getSizesDisplay(product)}
                  </TableCell>
                  <TableCell>{product.cost_price ? formatCurrency(product.cost_price, currency) : "-"}</TableCell>
                  <TableCell>{formatCurrency(product.price, currency)}</TableCell>
                  <TableCell>
                    <span className={product.stock < 10 ? "text-destructive font-semibold" : ""}>
                      {formatNumber(product.stock, 0)}
                    </span>
                  </TableCell>
                  <TableCell>{product.barcode || "-"}</TableCell>
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

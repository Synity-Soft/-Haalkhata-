// Inventory management: products, batches, stock levels, add/edit/delete
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Package,
  Layers,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Tag,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches } from '@/db/hooks'
import { addProduct, updateProduct, deleteProduct, addBatch, deleteBatch } from '@/db/mutations'
import { Card, Button, Badge, Modal, EmptyState, DemoBadge, ProductIcon } from '@/components/ui'
import { toBengaliDigits } from '@/lib/bn'
import { api, getAuditedOutletId, type OutletInventoryItem } from '@/lib/api'
import { daysUntilExpiry, getExpiryRisk, getRiskBadgeColor, getProductName } from '@/lib/utils'
import { StockBar, Stagger, showSaveToast } from '@/components/motion'
import type { Product, Batch, ProductCategory } from '@/types'

export default function Inventory() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId) as Product[] | undefined
  const rawBatches = useBatches(shopId) as Batch[] | undefined

  const products = rawProducts || []
  const batches = rawBatches || []

  // Backend Integration State (Stage 4.9)
  const outletId = getAuditedOutletId(shopId)
  const [backendItems, setBackendItems] = useState<OutletInventoryItem[] | null>(null)
  const [backendTotal, setBackendTotal] = useState<number>(0)
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [inventoryError, setInventoryError] = useState<string | null>(null)

  const fetchInventory = useCallback(async () => {
    if (!outletId) {
      setBackendItems(null)
      setBackendTotal(0)
      setInventoryLoading(false)
      setInventoryError(null)
      return
    }
    setInventoryLoading(true)
    setInventoryError(null)
    try {
      const res = await api.outletInventory(outletId, { limit: 200 })
      setBackendItems(res.items)
      setBackendTotal(res.total_matching_products)
    } catch (err: any) {
      console.warn('Inventory backend fetch failed, using local fallback:', err)
      setInventoryError(err.message || 'Backend unreachable')
      setBackendItems(null)
      setBackendTotal(0)
    } finally {
      setInventoryLoading(false)
    }
  }, [outletId])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const dataSource: 'backend' | 'local' | 'loading' | 'error' = inventoryLoading
    ? 'loading'
    : inventoryError
    ? 'error'
    : backendItems
    ? 'backend'
    : 'local'

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [targetProductId, setTargetProductId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)

  // Product Form state
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState<ProductCategory>('grain')
  const [formCostPrice, setFormCostPrice] = useState<number>(50)
  const [formSellingPrice, setFormSellingPrice] = useState<number>(60)
  const [formUnit, setFormUnit] = useState('kg')
  const [formInitialBatchQty, setFormInitialBatchQty] = useState<number>(20)
  const [formInitialExpiry, setFormInitialExpiry] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 60)
    return d.toISOString().split('T')[0]
  })

  // Batch Form state
  const [batchQty, setBatchQty] = useState<number>(10)
  const [batchExpiry, setBatchExpiry] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 45)
    return d.toISOString().split('T')[0]
  })

  // Stock calculation per product
  const productStockMap = useMemo(() => {
    const map = new Map<string, { totalStock: number; hasExpired: boolean; batchCount: number }>()
    for (const p of products) {
      const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
      const totalStock = pBatches.reduce((sum, b) => sum + b.quantity, 0)
      const hasExpired = pBatches.some((b) => daysUntilExpiry(b.expiryDate) < 0)
      map.set(p.id, { totalStock, hasExpired, batchCount: pBatches.length })
    }
    return map
  }, [products, batches])

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p as any).nameEn?.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      // Category
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false

      // Status
      const stockInfo = productStockMap.get(p.id) || { totalStock: 0, hasExpired: false, batchCount: 0 }
      if (selectedStatus === 'inStock' && stockInfo.totalStock <= 0) return false
      if (selectedStatus === 'lowStock' && (stockInfo.totalStock <= 0 || stockInfo.totalStock > 10))
        return false
      if (selectedStatus === 'outOfStock' && stockInfo.totalStock > 0) return false
      if (selectedStatus === 'expired' && !stockInfo.hasExpired) return false

      return true
    })
  }, [products, searchQuery, selectedCategory, selectedStatus, productStockMap])

  // Filtered backend inventory items (when backend is active)
  const filteredBackendItems = useMemo(() => {
    if (!backendItems) return []
    return backendItems.filter((item) => {
      // Search
      const matchesSearch =
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.product_name_bn && item.product_name_bn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.product_id.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      // Category
      if (selectedCategory !== 'all') {
        const catLower = item.category.toLowerCase()
        const selectedLower = selectedCategory.toLowerCase()
        if (!catLower.includes(selectedLower) && !selectedLower.includes(catLower)) return false
      }

      // Status
      if (selectedStatus === 'inStock' && item.available_quantity <= 0) return false
      if (selectedStatus === 'lowStock' && !item.is_low_stock) return false
      if (selectedStatus === 'outOfStock' && item.available_quantity > 0) return false

      return true
    })
  }, [backendItems, searchQuery, selectedCategory, selectedStatus])

  // Handlers
  const handleOpenAddProduct = () => {
    setEditingProduct(null)
    setFormName('')
    setFormCategory('grain')
    setFormCostPrice(50)
    setFormSellingPrice(60)
    setFormUnit('kg')
    setFormInitialBatchQty(20)
    const d = new Date()
    d.setDate(d.getDate() + 60)
    setFormInitialExpiry(d.toISOString().split('T')[0])
    setProductModalOpen(true)
  }

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p)
    setFormName(p.name)
    setFormCategory(p.category)
    setFormCostPrice(p.costPrice || (p as any).pricePerUnit || 0)
    setFormSellingPrice(p.sellingPrice || (p as any).pricePerUnit || 0)
    setFormUnit(p.unit || 'kg')
    setProductModalOpen(true)
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    if (editingProduct) {
      await updateProduct(editingProduct.id, {
        name: formName.trim(),
        category: formCategory,
        costPrice: Number(formCostPrice),
        sellingPrice: Number(formSellingPrice),
        unit: formUnit,
      })
    } else {
      const newProdId = await addProduct({
        shopId,
        name: formName.trim(),
        category: formCategory,
        costPrice: Number(formCostPrice),
        sellingPrice: Number(formSellingPrice),
        unit: formUnit,
      })

      if (formInitialBatchQty > 0) {
        await addBatch({
          productId: newProdId,
          shopId,
          quantity: Number(formInitialBatchQty),
          expiryDate: formInitialExpiry,
          addedAt: new Date().toISOString(),
        })
      }
    }

    setProductModalOpen(false)
    showSaveToast(lang === 'bn' ? 'পণ্য সফলভাবে সংরক্ষিত হয়েছে' : 'Product saved successfully')
  }

  const handleOpenAddBatch = (productId: string) => {
    setTargetProductId(productId)
    setBatchQty(10)
    const d = new Date()
    d.setDate(d.getDate() + 45)
    setBatchExpiry(d.toISOString().split('T')[0])
    setBatchModalOpen(true)
  }

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetProductId || batchQty <= 0) return

    await addBatch({
      productId: targetProductId,
      shopId,
      quantity: Number(batchQty),
      expiryDate: batchExpiry,
      addedAt: new Date().toISOString(),
    })

    setBatchModalOpen(false)
    showSaveToast(lang === 'bn' ? 'নতুন ব্যাচ যোগ করা হয়েছে' : 'New batch added successfully')
  }

  const handleDeleteProduct = async () => {
    if (deletingProductId) {
      await deleteProduct(deletingProductId)
      setDeleteConfirmOpen(false)
      setDeletingProductId(null)
      showSaveToast(lang === 'bn' ? 'পণ্য মুছে ফেলা হয়েছে' : 'Product deleted')
    }
  }

  const categoriesList: ProductCategory[] = [
    'grain',
    'oil',
    'dairy',
    'vegetables',
    'spices',
    'beverages',
    'snacks',
    'cleaning',
    'other',
  ]

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.inventory.searchProducts || (lang === 'bn' ? 'পণ্য ইনভেন্টরি' : 'Product Inventory')}
            </h1>
            <DemoBadge
              source={dataSource}
              outletId={outletId}
              error={inventoryError}
              onRetry={fetchInventory}
            />
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {backendItems
              ? (lang === 'bn'
                  ? `মোট ${formatNum(backendTotal)} টি সক্রিয় স্টক পণ্য তালিকাভুক্ত (${outletId})`
                  : `Total ${formatNum(backendTotal)} active stock products listed (${outletId})`)
              : (lang === 'bn'
                  ? `মোট ${formatNum(products.length)} টি পণ্য তালিকাভুক্ত`
                  : `Total ${formatNum(products.length)} products listed`)}
          </p>
        </div>

        <Button
          onClick={handleOpenAddProduct}
          className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>{t.inventory.addProduct}</span>
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Live Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-brown/50 dark:text-brand-cream/50" />
            <input
              type="text"
              placeholder={lang === 'bn' ? 'পণ্যের নাম খুঁজুন...' : 'Search by product name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-yellow"
            >
              <option value="all">{t.inventory.allCategories}</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {t.categories[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-yellow"
            >
              <option value="all">{t.inventory.allStatuses}</option>
              <option value="inStock">{t.inventory.inStock}</option>
              <option value="lowStock">{t.inventory.lowStock}</option>
              <option value="outOfStock">{t.inventory.outOfStock}</option>
              <option value="expired">{t.inventory.expired}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Products List / Table */}
      {inventoryLoading ? (
        <Card className="p-8 text-center text-brand-brown/70 dark:text-brand-cream/70">
          <div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full mx-auto mb-3" />
          <p className="font-semibold text-sm">
            {lang === 'bn' ? 'ব্যাকএন্ড ইনভেন্টরি ডাটা লোড হচ্ছে...' : 'Loading inventory from backend...'}
          </p>
        </Card>
      ) : backendItems ? (
        filteredBackendItems.length === 0 ? (
          <EmptyState
            icon={Package}
            title={lang === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
            description={
              lang === 'bn'
                ? 'আপনার অনুসন্ধান বা ফিল্টার পরিবর্তন করুন।'
                : 'Try adjusting your search filters.'
            }
          />
        ) : (
          <Stagger className="space-y-3">
            {filteredBackendItems.map((item) => (
              <Card key={item.product_id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <ProductIcon name={item.product_name} category={item.category as any} size={36} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream truncate">
                        {lang === 'bn' ? (item.product_name_bn || item.product_name) : item.product_name}
                      </h3>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-cream/60 dark:bg-black/30 border border-brand-brown/10 text-brand-brown/70 dark:text-brand-cream/70">
                        {item.product_id}
                      </span>
                      {item.is_low_stock ? (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t.inventory.lowStock}</span>
                        </Badge>
                      ) : (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>{t.inventory.inStock}</span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 flex-wrap">
                      <span>শ্রেণি: <strong>{item.category}</strong></span>
                      <span>•</span>
                      <span>পরিমাপ একক: <strong>{item.unit}</strong></span>
                      <span>•</span>
                      <span>সক্রিয় ব্যাচ: <strong>{toBengaliDigits(item.active_batch_count)} টি</strong></span>
                      {item.nearest_expiry_date && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                            <Clock className="w-3 h-3" />
                            নিকটবর্তী মেয়াদ: {item.nearest_expiry_date}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-right">
                    <div className="text-xs text-brand-brown/60 dark:text-brand-cream/60">মজুদ পরিমাণ</div>
                    <div className="text-lg font-black text-brand-brown dark:text-brand-cream">
                      {formatNum(item.available_quantity)} <span className="text-xs font-normal text-brand-brown/70 dark:text-brand-cream/70">{item.unit}</span>
                    </div>
                  </div>
                  {item.selling_price_bdt !== null && item.selling_price_bdt !== undefined && (
                    <div className="text-right border-l pl-3 border-brand-brown/10">
                      <div className="text-xs text-brand-brown/60 dark:text-brand-cream/60">খুচরা মূল্য</div>
                      <div className="text-base font-bold text-brand-orange">
                        ৳{formatNum(item.selling_price_bdt)}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </Stagger>
        )
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={lang === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
          description={
            lang === 'bn'
              ? 'আপনার অনুসন্ধান বা ফিল্টার পরিবর্তন করুন, অথবা নতুন পণ্য যোগ করুন।'
              : 'Try adjusting your search filters or add a new product.'
          }
          action={{
            label: t.inventory.addProduct,
            onClick: handleOpenAddProduct,
          }}
        />
      ) : (
        <Stagger className="space-y-3">
          {filteredProducts.map((product) => {
            const stockInfo = productStockMap.get(product.id) || {
              totalStock: 0,
              hasExpired: false,
              batchCount: 0,
            }
            const isExpanded = expandedProductId === product.id
            const productBatches = batches.filter((b) => b.productId === product.id && !b.deleted)

            // Stock badge status
            let statusBadge = (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{t.inventory.inStock}</span>
              </Badge>
            )
            if (stockInfo.hasExpired) {
              statusBadge = (
                <Badge variant="danger" className="flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t.inventory.expired}</span>
                </Badge>
              )
            } else if (stockInfo.totalStock === 0) {
              statusBadge = (
                <Badge variant="danger" className="flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t.inventory.outOfStock}</span>
                </Badge>
              )
            } else if (stockInfo.totalStock <= 10) {
              statusBadge = (
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{t.inventory.lowStock}</span>
                </Badge>
              )
            }

            return (
              <Card key={product.id} className="overflow-hidden transition-all duration-150">
                {/* Product Summary Row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                      className="mt-1 p-1 rounded-lg hover:bg-brand-cream/60 text-brand-brown dark:text-brand-cream transition-colors"
                      title={isExpanded ? 'Collapse batches' : 'Expand batches'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-brand-orange" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="mt-0.5 shrink-0">
                      <ProductIcon name={product.name} category={product.category} size={36} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base sm:text-lg text-brand-brown dark:text-brand-cream">
                          {getProductName(product, lang)}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-brand-cream/80 dark:bg-[#3d230e] text-xs font-medium text-brand-brown dark:text-brand-cream">
                          {t.categories[product.category] || product.category}
                        </span>
                        {statusBadge}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 flex-wrap">
                        <span>
                          {t.inventory.costPrice}:{' '}
                          <strong className="text-brand-brown dark:text-brand-cream">
                            {formatCurrency(product.costPrice || (product as any).pricePerUnit || 0)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          {t.inventory.sellingPrice}:{' '}
                          <strong className="text-brand-brown dark:text-brand-cream">
                            {formatCurrency(product.sellingPrice || (product as any).pricePerUnit || 0)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          {lang === 'bn' ? 'একক' : 'Unit'}: {product.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right actions & stock count */}
                  <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-left md:text-right">
                      <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 block">
                        {t.purchase.currentStock}
                      </span>
                      <span className="text-lg font-bold text-brand-brown dark:text-brand-cream">
                        {formatNum(stockInfo.totalStock)} {product.unit}
                      </span>
                      <div className="flex justify-start md:justify-end mt-1">
                        <StockBar current={stockInfo.totalStock} max={Math.max(stockInfo.totalStock, 40)} threshold={10} className="w-24" />
                      </div>
                      <span className="text-xs text-brand-orange block mt-0.5">
                        ({formatNum(stockInfo.batchCount)} {lang === 'bn' ? 'ব্যাচ' : 'batches'})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenAddBatch(product.id)}
                        className="p-2 rounded-xl text-brand-brown dark:text-brand-cream hover:bg-brand-cream/60 transition-colors"
                        title={lang === 'bn' ? 'নতুন ব্যাচ যোগ করুন' : 'Add new batch'}
                      >
                        <Plus className="w-4 h-4 text-brand-orange" />
                      </button>
                      <button
                        onClick={() => handleOpenEditProduct(product)}
                        className="p-2 rounded-xl text-brand-brown dark:text-brand-cream hover:bg-brand-cream/60 transition-colors"
                        title="Edit product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingProductId(product.id)
                          setDeleteConfirmOpen(true)
                        }}
                        className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Batch Details */}
                {isExpanded && (
                  <div className="bg-brand-cream/20 dark:bg-[#150c05] border-t border-[#F0D080]/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-brand-orange" />
                        <span>{t.inventory.batchDetails}</span>
                      </h4>
                      <Button
                        size="sm"
                        onClick={() => handleOpenAddBatch(product.id)}
                        className="text-xs flex items-center gap-1 bg-brand-yellow text-brand-brown font-semibold py-1 px-3"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.inventory.addBatch}</span>
                      </Button>
                    </div>

                    {productBatches.length === 0 ? (
                      <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60 italic py-2">
                        {lang === 'bn' ? 'কোনো সক্রিয় ব্যাচ নেই' : 'No active batches available'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {productBatches.map((batch) => {
                          const daysRem = daysUntilExpiry(batch.expiryDate)
                          const risk = getExpiryRisk(daysRem)
                          return (
                            <div
                              key={batch.id}
                              className="p-3 rounded-xl bg-white dark:bg-[#201309] border border-[#F0D080]/30 flex items-center justify-between"
                            >
                              <div>
                                <span className="text-sm font-bold text-brand-brown dark:text-brand-cream block">
                                  {formatNum(batch.quantity)} {product.unit}
                                </span>
                                <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3" />
                                  <span>{batch.expiryDate}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge className={getRiskBadgeColor(risk)}>
                                  {daysRem < 0
                                    ? t.expiry.expired
                                    : `${formatNum(daysRem)} ${lang === 'bn' ? 'দিন' : 'd'}`}
                                </Badge>
                                <button
                                  onClick={() => deleteBatch(batch.id)}
                                  className="text-brand-brown/40 hover:text-red-600 p-1 transition-colors"
                                  title="Delete batch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </Stagger>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingProduct ? t.inventory.editProduct : t.inventory.addProduct}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.inventory.productName} *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. চিনি (Sugar)"
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {t.inventory.category}
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {t.categories[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {t.inventory.unit}
              </label>
              <select
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              >
                <option value="kg">{t.units.kg}</option>
                <option value="g">{t.units.g}</option>
                <option value="litre">{t.units.liter}</option>
                <option value="packet">{t.units.pack}</option>
                <option value="piece">{t.units.piece}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {t.inventory.costPrice} (৳) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formCostPrice}
                onChange={(e) => setFormCostPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {t.inventory.sellingPrice} (৳) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formSellingPrice}
                onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>
          </div>

          {!editingProduct && (
            <div className="p-3 rounded-xl bg-brand-cream/30 border border-[#F0D080]/50 space-y-3">
              <span className="text-xs font-bold text-brand-orange block">
                {lang === 'bn' ? 'প্রাথমিক স্টক ও মেয়াদ (ঐচ্ছিক)' : 'Initial Batch & Expiry (Optional)'}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-brand-brown/70 dark:text-brand-cream/70 mb-1">
                    {t.inventory.quantity}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formInitialBatchQty}
                    onChange={(e) => setFormInitialBatchQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#F0D080] bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brand-brown/70 dark:text-brand-cream/70 mb-1">
                    {t.inventory.expiryDate}
                  </label>
                  <input
                    type="date"
                    value={formInitialExpiry}
                    onChange={(e) => setFormInitialExpiry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#F0D080] bg-white text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Batch Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={t.inventory.addBatch}
      >
        <form onSubmit={handleSaveBatch} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.inventory.quantity} *
            </label>
            <input
              type="number"
              required
              min="1"
              value={batchQty}
              onChange={(e) => setBatchQty(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.inventory.expiryDate} *
            </label>
            <input
              type="date"
              required
              value={batchExpiry}
              onChange={(e) => setBatchExpiry(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBatchModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={t.inventory.confirmDelete}
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-brown/80 dark:text-brand-cream/80">
            {t.inventory.deleteWarning}
          </p>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" onClick={handleDeleteProduct}>
              {t.common.delete}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}


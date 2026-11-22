"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  createReviewAction,
  deleteReviewAction,
  importReviewsAction,
  listReviewsAction,
  publishReviewAction,
  unpublishReviewAction,
} from "./actions";
import { StarRating } from "@/components/storefront/engine/sections/reviews";

interface ReviewItem {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  status: "published" | "unpublished";
  source: "merchant_entered" | "imported";
  originLabel: string | null;
  reviewedAt: string;
  createdAt: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newOrigin, setNewOrigin] = useState("");
  const [createPending, setCreatePending] = useState(false);

  // Import Modal
  const [importOpen, setImportOpen] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [validateOnly, setValidateOnly] = useState(false);
  const [attested, setAttested] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; field: string; message: string }>>([]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const res = await listReviewsAction(statusFilter ? { status: statusFilter } : undefined);
      if (res.ok && res.data) {
        setReviews(res.data.items);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, [statusFilter]);

  const handleToggleStatus = async (review: ReviewItem) => {
    const next = review.status === "published" ? "unpublished" : "published";
    const action = next === "published" ? publishReviewAction : unpublishReviewAction;
    const res = await action(review.id);
    if (res.ok) {
      toast.success(`Review ${next}`);
      void loadReviews();
    } else {
      toast.error(res.error || "Failed to update review status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Permanently delete this review?")) return;
    const res = await deleteReviewAction(id);
    if (res.ok) {
      toast.success("Review deleted");
      void loadReviews();
    } else {
      toast.error(res.error || "Failed to delete review");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductId || !newAuthor || !newTitle || !newBody) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setCreatePending(true);
    try {
      const res = await createReviewAction({
        productId: newProductId.trim(),
        authorName: newAuthor.trim(),
        rating: Number(newRating),
        title: newTitle.trim(),
        body: newBody.trim(),
        originLabel: newOrigin.trim() || undefined,
        status: "published",
      });
      if (res.ok) {
        toast.success("Review created");
        setCreateOpen(false);
        setNewAuthor("");
        setNewTitle("");
        setNewBody("");
        setNewOrigin("");
        void loadReviews();
      } else {
        toast.error(res.error || "Failed to create review");
      }
    } finally {
      setCreatePending(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) {
      toast.error("CSV content is required.");
      return;
    }
    if (!validateOnly && !attested) {
      toast.error("You must attest that imported reviews are authentic.");
      return;
    }
    setImportPending(true);
    setImportErrors([]);
    try {
      const res = await importReviewsAction({
        csvContent,
        validateOnly,
      });
      if (!res.ok) {
        toast.error(res.error || "Import failed");
        return;
      }
      if (res.data) {
        if (validateOnly) {
          if (res.data.errors.length > 0) {
            setImportErrors(res.data.errors);
            toast.error(`Validation found ${res.data.errors.length} error(s).`);
          } else {
            toast.success(`Validation passed: ${res.data.validRows} row(s) ready.`);
          }
        } else {
          toast.success(`Successfully imported ${res.data.importedRows} review(s).`);
          setImportOpen(false);
          setCsvContent("");
          void loadReviews();
        }
      }
    } finally {
      setImportPending(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Manage merchant-entered and imported customer reviews. Disclosed on storefront as merchant feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 mr-1.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" /> Add Review
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="text-xs text-muted-foreground">
            Status:
          </Label>
          <NativeSelect
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 text-xs w-36"
          >
            <option value="">All Reviews</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </NativeSelect>
        </div>
      </div>

      {/* Reviews Table / List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {reviews.length} {reviews.length === 1 ? "Review" : "Reviews"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> Loading reviews…
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
              <MessageSquare className="size-8 text-muted-foreground/40 mb-2" />
              <p className="font-medium text-foreground">No reviews found</p>
              <p className="text-xs mt-1">Add your first review or import from CSV.</p>
            </div>
          ) : (
            <div className="divide-y">
              {reviews.map((r) => (
                <div key={r.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <StarRating rating={r.rating} size="sm" />
                      <span className="font-semibold text-sm text-foreground truncate">{r.title}</span>
                      <Badge variant={r.status === "published" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {r.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        {r.source === "imported" ? "Imported" : "Merchant"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.body}</p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>By: <strong className="text-foreground">{r.authorName}</strong></span>
                      {r.originLabel ? <span>Origin: {r.originLabel}</span> : null}
                      <time>{new Date(r.reviewedAt).toLocaleDateString()}</time>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={r.status === "published" ? "outline" : "default"}
                      size="xs"
                      onClick={() => handleToggleStatus(r)}
                    >
                      {r.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(r.id)}
                      title="Delete review"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Review Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Add Customer Review</DialogTitle>
              <DialogDescription>
                Add a merchant-entered review for a product. Disclosed publicly as merchant-collected feedback.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4">
              <div>
                <Label htmlFor="rev-prod-id" className="text-xs">Product UUID *</Label>
                <Input
                  id="rev-prod-id"
                  required
                  placeholder="e.g. 12345678-1234-1234-1234-123456789abc"
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="rev-author" className="text-xs">Author Name *</Label>
                  <Input
                    id="rev-author"
                    required
                    maxLength={80}
                    placeholder="e.g. Jane Doe"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="rev-rating" className="text-xs">Rating (1–5) *</Label>
                  <NativeSelect
                    id="rev-rating"
                    value={String(newRating)}
                    onChange={(e) => setNewRating(Number(e.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((s) => (
                      <option key={s} value={s}>{s} Star{s > 1 ? "s" : ""}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div>
                <Label htmlFor="rev-title" className="text-xs">Review Title *</Label>
                <Input
                  id="rev-title"
                  required
                  maxLength={120}
                  placeholder="e.g. Excellent quality and fast shipping"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="rev-body" className="text-xs">Review Body *</Label>
                <Textarea
                  id="rev-body"
                  required
                  maxLength={5000}
                  rows={4}
                  placeholder="The customer's feedback..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="rev-origin" className="text-xs">Origin Label (Optional)</Label>
                <Input
                  id="rev-origin"
                  maxLength={60}
                  placeholder="e.g. Verified In-Store"
                  value={newOrigin}
                  onChange={(e) => setNewOrigin(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPending}>
                {createPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null} Create Review
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleImportSubmit}>
            <DialogHeader>
              <DialogTitle>Import Reviews from CSV</DialogTitle>
              <DialogDescription>
                Import reviews in bulk. Header format: <code>author_name,rating,title,body,product_id,product_slug,origin_label</code>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="csv-text" className="text-xs">CSV Data</Label>
                <Textarea
                  id="csv-text"
                  required
                  rows={8}
                  placeholder={'author_name,rating,title,body,product_id,product_slug,origin_label\n"John Doe",5,"Great product","Loved the material",,"sample-t-shirt","Imported"'}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="val-only"
                  checked={validateOnly}
                  onCheckedChange={(c) => setValidateOnly(Boolean(c))}
                />
                <Label htmlFor="val-only" className="text-xs font-normal cursor-pointer">
                  Validate only (check CSV rows without saving to database)
                </Label>
              </div>

              {!validateOnly ? (
                <div className="rounded-lg border bg-amber-500/10 p-3 space-y-2 border-amber-500/30">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="attest-check"
                      checked={attested}
                      onCheckedChange={(c) => setAttested(Boolean(c))}
                      className="mt-0.5"
                    />
                    <Label htmlFor="attest-check" className="text-xs font-normal cursor-pointer text-foreground leading-snug">
                      <strong>Legal Attestation:</strong> I attest that these reviews represent genuine customer feedback collected from verified past purchases and contain no fabricated or compensated ratings.
                    </Label>
                  </div>
                </div>
              ) : null}

              {importErrors.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                  <p className="text-xs font-bold text-destructive">Row Errors:</p>
                  {importErrors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Row {err.row} [{err.field}]: {err.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={importPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={importPending || (!validateOnly && !attested)}>
                {importPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                {validateOnly ? "Validate CSV" : "Import Reviews"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

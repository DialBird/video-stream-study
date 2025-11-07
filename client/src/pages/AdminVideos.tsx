import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, Upload, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminVideos() {
  const { user, loading: authLoading } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: videos, isLoading, refetch } = trpc.video.listAll.useQuery();
  const createVideoMutation = trpc.video.create.useMutation();
  const deleteVideoMutation = trpc.video.delete.useMutation();
  const updatePublishedStatusMutation = trpc.video.updatePublishedStatus.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast.error("動画ファイルを選択してください");
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        toast.error("ファイルサイズは500MB以下にしてください");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      toast.error("タイトルとファイルを入力してください");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const fileKey = `videos/${user?.id}/${timestamp}-${randomSuffix}-${selectedFile.name}`;

      const formData = new FormData();
      formData.append("video", selectedFile);
      formData.append("fileKey", fileKey);

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      const uploadPromise = new Promise<{ url: string; fileKey: string }>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error("Upload failed"));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("POST", "/api/upload-video");
        xhr.send(formData);
      });

      const uploadResult = await uploadPromise;

      // Create video record in database
      await createVideoMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        fileKey: uploadResult.fileKey,
        url: uploadResult.url,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
      });

      toast.success("動画をアップロードしました");
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setUploadProgress(0);
      refetch();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この動画を削除してもよろしいですか?")) {
      return;
    }

    try {
      await deleteVideoMutation.mutateAsync({ id });
      toast.success("動画を削除しました");
      refetch();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("削除に失敗しました");
    }
  };

  const handleTogglePublished = async (id: number, currentStatus: number) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    try {
      await updatePublishedStatusMutation.mutateAsync({ id, isPublished: newStatus });
      toast.success(newStatus === 1 ? "動画を公開しました" : "動画を非公開にしました");
      refetch();
    } catch (error) {
      console.error("Update published status error:", error);
      toast.error("公開状態の変更に失敗しました");
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8">
        <h1 className="text-3xl font-bold mb-8">動画管理</h1>

        {/* Upload Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>動画をアップロード</CardTitle>
            <CardDescription>新しい動画をアップロードして公開します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="動画のタイトルを入力"
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="動画の説明を入力（任意）"
                rows={3}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video">動画ファイル *</Label>
              <Input
                id="video"
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  選択: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>アップロード中...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !title.trim()}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  アップロード
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Video List */}
        <Card>
          <CardHeader>
            <CardTitle>アップロード済み動画</CardTitle>
            <CardDescription>管理画面から動画を管理できます</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : videos && videos.length > 0 ? (
              <div className="space-y-4">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Video className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{video.title}</h3>
                        {video.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {video.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {(video.fileSize / 1024 / 1024).toFixed(2)} MB • {video.viewCount} 回視聴
                          {video.isPublished === 0 && (
                            <span className="ml-2 text-orange-500">（非公開）</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`published-${video.id}`} className="text-sm">
                          {video.isPublished === 1 ? "公開" : "非公開"}
                        </Label>
                        <Switch
                          id={`published-${video.id}`}
                          checked={video.isPublished === 1}
                          onCheckedChange={() => handleTogglePublished(video.id, video.isPublished)}
                          disabled={updatePublishedStatusMutation.isPending}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(video.id)}
                        disabled={deleteVideoMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                まだ動画がアップロードされていません
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

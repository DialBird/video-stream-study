import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Loader2, Play, Video as VideoIcon } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { data: videos, isLoading } = trpc.video.list.useQuery();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8" />}
            <h1 className="text-xl font-bold">{APP_TITLE}</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/admin/videos">
                  <Button variant="outline">管理画面</Button>
                </Link>
                <span className="text-sm text-muted-foreground">{user?.name}</span>
              </>
            ) : (
              <Button asChild>
                <a href={getLoginUrl()}>ログイン</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container py-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">動画ストリーミングプラットフォーム</h2>
            <p className="text-lg text-muted-foreground">
              YouTubeのように動画をアップロードして共有できるプラットフォーム
            </p>
          </div>

          {/* Video Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <a key={video.id} href={`/watch/${video.id}`} className="block">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                    <CardHeader className="p-0">
                      <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg relative">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover rounded-t-lg"
                          />
                        ) : (
                          <VideoIcon className="w-16 h-16 text-muted-foreground" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-t-lg opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="w-12 h-12 text-white" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <CardTitle className="text-lg mb-2 line-clamp-2">{video.title}</CardTitle>
                      {video.description && (
                        <CardDescription className="line-clamp-2">
                          {video.description}
                        </CardDescription>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {video.viewCount} 回視聴
                        </p>
                        {video.isPublished === 0 && (
                          <span className="text-xs text-orange-500 font-medium">（非公開）</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <VideoIcon className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground mb-4">まだ動画がありません</p>
                {isAuthenticated && (
                  <Button asChild>
                    <Link href="/admin/videos">最初の動画をアップロード</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {APP_TITLE}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

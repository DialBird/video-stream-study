import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";

export default function VideoWatch() {
  const params = useParams<{ id: string }>();
  const videoId = params.id ? parseInt(params.id) : null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasIncrementedView, setHasIncrementedView] = useState(false);

  const { data: video, isLoading, error } = trpc.video.getById.useQuery(
    { id: videoId! },
    { enabled: videoId !== null }
  );

  const incrementViewMutation = trpc.video.incrementView.useMutation();

  // Handle video loading error (including 401 unauthorized)
  useEffect(() => {
    if (error) {
      console.error("Video load error:", error);
    }
  }, [error]);

  // Increment view count when video starts playing
  useEffect(() => {
    if (!video || hasIncrementedView) return;

    const handlePlay = () => {
      if (!hasIncrementedView) {
        incrementViewMutation.mutate({ id: video.id });
        setHasIncrementedView(true);
      }
    };

    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.addEventListener("play", handlePlay);
      return () => videoElement.removeEventListener("play", handlePlay);
    }
  }, [video, hasIncrementedView, incrementViewMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b">
          <div className="container flex items-center justify-between h-16">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
            </Link>
            <h1 className="text-xl font-bold">{APP_TITLE}</h1>
            <div className="w-20" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b">
          <div className="container flex items-center justify-between h-16">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
            </Link>
            <h1 className="text-xl font-bold">{APP_TITLE}</h1>
            <div className="w-20" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-lg text-muted-foreground">動画が見つかりません</p>
              <Button asChild className="mt-4">
                <Link href="/">ホームに戻る</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Button>
          </Link>
          <h1 className="text-xl font-bold">{APP_TITLE}</h1>
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-black/5">
        <div className="container max-w-6xl py-8">
          {/* Video Player */}
          <div className="bg-black rounded-lg overflow-hidden mb-6">
            <video
              ref={videoRef}
              className="w-full aspect-video"
              controls
              preload="metadata"
              src={video.url}
              onError={(e) => {
                const videoElement = e.currentTarget;
                if (videoElement.error) {
                  const error = videoElement.error;
                  if (error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED || error.code === error.MEDIA_ERR_NETWORK) {
                    // Check if it's a 401 error by fetching the URL
                    fetch(video.url)
                      .then(response => {
                        if (response.status === 401) {
                          console.log("Video requires authentication");
                          // You can show a message or redirect to login
                        }
                      })
                      .catch(() => {
                        // Network error or other issue
                      });
                  }
                }
              }}
            >
              <source src={video.url} type={video.mimeType} />
              お使いのブラウザは動画タグをサポートしていません。
            </video>
          </div>

          {/* Video Info */}
          <Card>
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold mb-4">{video.title}</h1>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{video.viewCount} 回視聴</span>
                </div>
                <span>•</span>
                <span>
                  {new Date(video.createdAt).toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              {video.description && (
                <div className="border-t pt-4">
                  <p className="text-sm whitespace-pre-wrap">{video.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 bg-background">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {APP_TITLE}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

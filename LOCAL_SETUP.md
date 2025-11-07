# ローカル環境セットアップガイド

このガイドでは、Video Stream Studyプロジェクトをローカル環境で動かす方法を説明します。

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- **Node.js**: v18以上
- **pnpm**: v8以上（`npm install -g pnpm`でインストール可能）
- **MySQL**: v8以上（またはTiDB、PlanetScaleなどのMySQL互換データベース）
- **Git**: 最新版

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/DialBird/video-stream-study.git
cd video-stream-study
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の環境変数を設定します：

```env
# データベース接続
DATABASE_URL=mysql://username:password@localhost:3306/video_stream_study

# JWT署名用シークレット（ランダムな文字列を生成してください）
JWT_SECRET=your-super-secret-jwt-key-here

# OAuth設定（Manus OAuth）
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
OWNER_OPEN_ID=your-open-id
OWNER_NAME=Your Name

# S3ストレージ設定（AWS S3または互換サービス）
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# アプリケーション設定
VITE_APP_TITLE=Video Stream Study
PORT=3000
NODE_ENV=development
```

### 4. データベースのセットアップ

MySQLデータベースを作成：

```sql
CREATE DATABASE video_stream_study CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

マイグレーションを実行：

```bash
pnpm db:push
```

### 5. 開発サーバーの起動

```bash
pnpm dev
```

サーバーが起動したら、ブラウザで http://localhost:3000 にアクセスしてください。

## 詳細な設定

詳細な設定方法やトラブルシューティングについては、プロジェクトのドキュメントを参照してください。

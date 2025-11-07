# Docker環境セットアップガイド

このガイドでは、Docker Composeを使用してVideo Stream Studyプロジェクトをローカル環境で簡単に起動する方法を説明します。

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- **Docker**: v20.10以上
- **Docker Compose**: v2.0以上
- **Make**: コマンドラインツール（オプション、推奨）

### Dockerのインストール確認

```bash
docker --version
docker-compose --version
```

## クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/DialBird/video-stream-study.git
cd video-stream-study
```

### 2. 環境変数の設定（オプション）

**認証バイパスはデータベースで管理されます**。初回起動後、`make bypass-auth`で認証バイパスを有効化できます。

OAuth認証を有効にしたい場合は、`.env`ファイルを作成して設定します：

```bash
cp env.example.txt .env
# .envファイルを編集
# Manus OAuthの設定を追加
```

### 3. Docker環境の起動

#### Makefileを使用する場合（推奨）

```bash
make up
```

#### Docker Composeを直接使用する場合

```bash
docker-compose up -d
```

### 4. アクセス

サービスが起動したら、以下のURLにアクセスできます：

- **アプリケーション**: http://localhost:3000
- **MinIO Console**: http://localhost:9001（ユーザー名: `minioadmin`、パスワード: `minioadmin123`）
- **MySQL**: `localhost:3306`（ユーザー名: `dbuser`、パスワード: `dbpassword`）

## Makefileコマンド一覧

Makefileを使用すると、Docker環境の管理が簡単になります。

### セットアップコマンド

| コマンド | 説明 |
|---------|------|
| `make setup` | 初期セットアップ（依存関係のインストール + .env作成） |
| `make install` | pnpmで依存関係をインストール |

### Docker操作コマンド

| コマンド | 説明 |
|---------|------|
| `make up` | すべてのサービスを起動（MySQL、MinIO、App） |
| `make down` | すべてのサービスを停止 |
| `make restart` | すべてのサービスを再起動 |
| `make logs` | すべてのサービスのログを表示 |
| `make logs-app` | アプリケーションのログのみ表示 |
| `make logs-mysql` | MySQLのログのみ表示 |
| `make logs-minio` | MinIOのログのみ表示 |
| `make clean` | サービスを停止してボリュームを削除 |

### データベース操作コマンド

| コマンド | 説明 |
|---------|------|
| `make db-migrate` | データベースマイグレーションを実行 |
| `make db-reset` | データベースをリセット（削除 + マイグレーション） |
| `make db-shell` | MySQLシェルを開く |

### ストレージ操作コマンド

| コマンド | 説明 |
|---------|------|
| `make minio-setup` | MinIOバケットをセットアップ |
| `make minio-console` | MinIO Consoleの接続情報を表示 |

### 開発コマンド（Docker不使用）

| コマンド | 説明 |
|---------|------|
| `make dev` | 開発サーバーを起動（ローカル） |
| `make build` | 本番用ビルドを作成 |
| `make test` | テストを実行 |

## Docker Compose構成

このプロジェクトのDocker Compose環境には、以下のサービスが含まれています：

### 1. MySQL（データベース）

**イメージ**: `mysql:8.0`

MySQLデータベースサーバーで、動画のメタデータ（タイトル、説明、URL、視聴回数など）を保存します。

**接続情報**:
- ホスト: `localhost`
- ポート: `3306`
- データベース: `video_stream_study`
- ユーザー名: `dbuser`
- パスワード: `dbpassword`

**データ永続化**: `mysql_data`ボリュームにデータが保存されます。

### 2. MinIO（S3互換ストレージ）

**イメージ**: `minio/minio:latest`

S3互換のオブジェクトストレージで、動画ファイルを保存します。

**接続情報**:
- APIエンドポイント: `http://localhost:9000`
- Console: `http://localhost:9001`
- アクセスキー: `minioadmin`
- シークレットキー: `minioadmin123`
- バケット名: `videos`

**データ永続化**: `minio_data`ボリュームにデータが保存されます。

### 3. アプリケーション（Node.js + Express + React）

**ビルド**: `Dockerfile.dev`

フロントエンド（React + Vite）とバックエンド（Express + tRPC）を含むメインアプリケーションです。

**環境変数**:
- `USE_LOCAL_STORAGE=true`: ローカルS3（MinIO）を使用
- `DATABASE_URL`: MySQL接続文字列
- その他の設定は`docker-compose.yml`を参照

## 使用例

### 基本的なワークフロー

```bash
# 1. 環境を起動
make up

# 2. ログを確認
make logs-app

# 3. ブラウザでアクセス
# http://localhost:3000

# 4. 動画をアップロード
# 管理画面（http://localhost:3000/admin/videos）から動画をアップロード

# 5. MinIO Consoleで確認
# http://localhost:9001 でアップロードされた動画を確認

# 6. 環境を停止
make down
```

### データベースのリセット

```bash
# データベースを完全にリセット
make db-reset
```

### ログの確認

```bash
# すべてのサービスのログをリアルタイムで表示
make logs

# アプリケーションのログのみ表示
make logs-app
```

### 完全なクリーンアップ

```bash
# サービスを停止し、すべてのボリュームを削除
make clean
```

## トラブルシューティング

### ポート競合エラー

```
Error: Bind for 0.0.0.0:3000 failed: port is already allocated
```

**解決方法**: 既存のプロセスを終了するか、`docker-compose.yml`でポート番号を変更します。

```yaml
services:
  app:
    ports:
      - "3001:3000"  # 3000 → 3001に変更
```

### MinIOバケットが作成されない

**解決方法**: MinIOセットアップを手動で実行します。

```bash
make minio-setup
```

### データベース接続エラー

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**解決方法**: MySQLサービスが完全に起動するまで待ちます。

```bash
# MySQLのログを確認
make logs-mysql

# ヘルスチェックが通るまで待つ
docker-compose ps
```

### アプリケーションが起動しない

**解決方法**: 依存関係を再インストールします。

```bash
# コンテナ内で依存関係を再インストール
docker-compose exec app pnpm install

# または、コンテナを再ビルド
docker-compose up -d --build
```

### ボリュームのクリーンアップ

データベースやストレージのデータを完全に削除したい場合：

```bash
# すべてのサービスを停止してボリュームを削除
make clean

# または
docker-compose down -v
```

## 本番環境への移行

Docker環境は開発用に最適化されています。本番環境では以下の変更を推奨します：

### セキュリティ強化

```yaml
environment:
  # 強力なパスワードに変更
  MYSQL_ROOT_PASSWORD: <strong-password>
  MYSQL_PASSWORD: <strong-password>
  MINIO_ROOT_PASSWORD: <strong-password>
  JWT_SECRET: <random-secret-key>
```

### ストレージの変更

本番環境では、MinIOの代わりにAWS S3やGoogle Cloud Storageを使用することを推奨します。

```yaml
environment:
  USE_LOCAL_STORAGE: "false"  # Manus Storageを使用
  # または
  AWS_S3_ENDPOINT: ""  # AWS S3を直接使用
```

### リソース制限

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G
```

## 参考リンク

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [MySQL Documentation](https://dev.mysql.com/doc/)

## サポート

問題が発生した場合は、以下を確認してください：

1. [README.md](./README.md) - プロジェクトの概要
2. [LOCAL_SETUP.md](./LOCAL_SETUP.md) - ローカル環境セットアップ（Docker不使用）
3. [GitHub Issues](https://github.com/DialBird/video-stream-study/issues) - 既知の問題

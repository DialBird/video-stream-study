# 認証バイパス機能（開発環境用）

このドキュメントでは、ローカル開発環境で使用する認証バイパス機能について説明します。

## 概要

Video Stream Studyは本来、Manus Platform上で動作することを想定しており、Manus OAuthによる認証が必要です。しかし、ローカル開発環境ではManus OAuthが利用できないため、**認証バイパス機能**を実装しています。

この機能を有効にすると、認証なしで管理者権限を持つデフォルトユーザーとして自動的にログインされます。

## 使用方法

### Docker環境の場合

Docker Composeを使用する場合、**デフォルトで認証バイパスが有効**になっています。特別な設定は不要です。

```bash
make up
# または
docker-compose up -d
```

ブラウザで http://localhost:3000 にアクセスすると、自動的に「Development User」としてログインされています。

### ローカル環境（Docker不使用）の場合

`.env`ファイルに以下の設定を追加します：

```bash
BYPASS_AUTH=true
```

その後、開発サーバーを起動します：

```bash
pnpm dev
```

## デフォルトユーザー情報

認証バイパスが有効な場合、以下のユーザー情報が使用されます：

| フィールド | 値 |
|-----------|-----|
| ID | 1 |
| OpenID | dev-user |
| 名前 | Development User |
| Eメール | dev@example.com |
| ログイン方法 | bypass |
| ロール | admin |

このユーザーは**管理者権限**を持っているため、すべての機能（動画のアップロード、削除など）にアクセスできます。

## 認証バイパスの無効化

本番環境やManus Platform上で動作させる場合は、認証バイパスを無効にする必要があります。

### 方法1: 環境変数を削除

`.env`ファイルから`BYPASS_AUTH`を削除するか、`false`に設定します：

```bash
BYPASS_AUTH=false
```

### 方法2: Docker Composeの設定変更

`docker-compose.yml`の`BYPASS_AUTH`行をコメントアウトまたは削除します：

```yaml
environment:
  # BYPASS_AUTH: "true"  # コメントアウト
```

## セキュリティ上の注意

### ⚠️ 重要な警告

**認証バイパス機能は開発環境専用です。本番環境では絶対に使用しないでください。**

この機能を有効にすると：

- 誰でも管理者としてアクセス可能
- すべてのデータの閲覧・編集・削除が可能
- セキュリティが完全に無効化される

### 推奨事項

1. **本番環境では必ず無効化**: `BYPASS_AUTH=false`または環境変数を設定しない
2. **環境変数の管理**: `.env`ファイルをGitにコミットしない（`.gitignore`に含まれています）
3. **Manus Platform上では不要**: Manus Platform上では自動的にManus OAuthが使用されます

## トラブルシューティング

### 認証バイパスが動作しない

**症状**: ローカル環境でログインエラーが発生する

**解決方法**:

1. 環境変数が正しく設定されているか確認：
   ```bash
   echo $BYPASS_AUTH
   # "true" が表示されるはず
   ```

2. サーバーを再起動：
   ```bash
   # Docker環境の場合
   make restart
   
   # ローカル環境の場合
   # Ctrl+C でサーバーを停止後
   pnpm dev
   ```

3. ログを確認：
   ```bash
   # Docker環境の場合
   make logs-app
   ```

### 本番環境で誤って有効になっている

**症状**: 本番環境で誰でもアクセスできてしまう

**解決方法**:

1. **即座に環境変数を削除**：
   ```bash
   unset BYPASS_AUTH
   ```

2. サーバーを再起動

3. `.env`ファイルや`docker-compose.yml`から`BYPASS_AUTH`設定を削除

## 実装詳細

認証バイパス機能は`server/_core/context.ts`で実装されています：

```typescript
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Development mode: bypass authentication
  if (process.env.BYPASS_AUTH === "true") {
    user = {
      id: 1,
      openId: "dev-user",
      name: "Development User",
      email: "dev@example.com",
      loginMethod: "bypass",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  } else {
    // 通常のManus OAuth認証
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
```

この実装により、`BYPASS_AUTH=true`が設定されている場合、すべてのリクエストで固定のユーザー情報が返されます。

## 将来の拡張

認証バイパス機能は開発用の暫定的な実装です。将来的には以下の認証方式の追加を検討できます：

- Eメール/パスワード認証
- Google OAuth
- GitHub OAuth
- その他のOAuthプロバイダー

これらの実装により、Manus Platformに依存しない独立したアプリケーションとして動作させることが可能になります。

## 参考リンク

- [DOCKER_SETUP.md](./DOCKER_SETUP.md) - Docker環境のセットアップ
- [LOCAL_SETUP.md](./LOCAL_SETUP.md) - ローカル環境のセットアップ
- [README.md](./README.md) - プロジェクト概要

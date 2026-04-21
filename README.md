# Novel Blog

여러 작가가 함께 쓰는 소설 블로그. Next.js + Turso + Tiptap.

## 구조

- `/` — 모든 작가의 최신 글 피드
- `/u/[username]` — 개별 작가의 블로그
- `/u/[username]/[slug]` — 개별 글
- `/write` — 글 작성 (로그인 필요)
- `/edit/[id]` — 글 수정
- `/dashboard` — 내 글 관리
- `/login`, `/signup`

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run db:push              # Turso에 스키마 반영
npm run dev
```

## 환경변수

- `TURSO_DATABASE_URL` — Turso libSQL URL
- `TURSO_AUTH_TOKEN` — Turso 토큰 (`turso db tokens create <db>`)
- `AUTH_SECRET` — JWT 서명용 비밀키 (48바이트 랜덤 base64)

## 배포 (Vercel)

1. GitHub 레포를 Vercel에 import
2. Vercel 프로젝트 Settings → Environment Variables에 위 3개 등록
3. `git push` 하면 자동 배포

## 스택

- Next.js 15 (App Router, Server Components)
- Turso (libSQL) + Drizzle ORM
- Tiptap (WYSIWYG 에디터)
- Tailwind CSS
- bcryptjs + jose (JWT 쿠키 세션)

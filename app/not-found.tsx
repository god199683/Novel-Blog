import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-slate-500">페이지를 찾을 수 없어요.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        홈으로
      </Link>
    </div>
  );
}

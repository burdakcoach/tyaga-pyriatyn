import { NextRequest, NextResponse } from "next/server";

// Protects /admin (the dashboard page) and /api/admin/* (the data it calls)
// with HTTP Basic Auth. Simple on purpose — this is a single-owner dashboard,
// not a multi-user system, so a shared username/password is enough.
export function middleware(request: NextRequest) {
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedPass) {
    // No password configured on this deploy — fail closed instead of leaving
    // customer names/phones/addresses open to anyone who finds the URL.
    return new NextResponse(
      "Адмін-панель не налаштована: додайте змінну середовища ADMIN_PASSWORD.",
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const sep = decoded.indexOf(":");
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next();
      }
    } catch {
      // fall through to 401 below
    }
  }

  return new NextResponse("Потрібна авторизація.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Tyaga Admin"' },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

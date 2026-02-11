#define UNICODE
#define _UNICODE
#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <windowsx.h>
#include <dwmapi.h>

#include "resource.h"

/* Visual Styles & Libraries */
#pragma comment(linker,"/manifestdependency:\"type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "dwmapi.lib")

/* Colors */
#define COL_BORDER RGB(218, 218, 218)
#define COL_TITLE  RGB(0, 0, 0)
#define COL_BTN_HOVER RGB(232, 17, 35)
#define COL_BTN_ICON RGB(0, 0, 0)
#define COL_BTN_ICON_HOVER RGB(255, 255, 255)

typedef struct {
  const wchar_t* title;
  const wchar_t* text;
  BOOL topmost;
  BOOL showTaskbar;
  BOOL allowClose;
  int speedMs;
  int width;
  int height;
  const wchar_t* waitEvent;
} Options;

static Options g_opt = { L"RoxyBrowser", NULL, TRUE, FALSE, TRUE, 40, 380, 150, NULL };

static HFONT g_hFont = NULL;
static HFONT g_hTitleFont = NULL;
static HFONT g_hCloseFont = NULL;
static RECT g_rcCloseBtn;
static BOOL g_bBtnHover = FALSE;
static BOOL g_bBtnDown = FALSE;

static const wchar_t* GetArg(const wchar_t* arg, const wchar_t* key) {
  size_t len = lstrlenW(key);
  if (wcsncmp(arg, key, len) == 0 && arg[len] == L'=') return arg + len + 1;
  return NULL;
}

static int ParseInt(const wchar_t* s, int def) {
  if (!s || !*s) return def;
  long v = wcstol(s, NULL, 10);
  return v ? (int)v : def;
}

static void InitArgs() {
  int argc = 0;
  int i;
  LPWSTR* argv;
  const wchar_t* v;

  /* Default Text */
  if (PRIMARYLANGID(GetUserDefaultUILanguage()) == LANG_CHINESE)
    g_opt.text = L"正在更新 RoxyBrowser...";
  else
    g_opt.text = L"Updating RoxyBrowser...";

  argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (!argv) return;

  for (i = 1; i < argc; i++) {
    const wchar_t* a = argv[i];
    if ((v = GetArg(a, L"--title"))) g_opt.title = v;
    else if ((v = GetArg(a, L"--text"))) g_opt.text = v;
    else if ((v = GetArg(a, L"--speed"))) g_opt.speedMs = ParseInt(v, g_opt.speedMs);
    else if ((v = GetArg(a, L"--width"))) g_opt.width = ParseInt(v, g_opt.width);
    else if ((v = GetArg(a, L"--height"))) g_opt.height = ParseInt(v, g_opt.height);
    else if ((v = GetArg(a, L"--wait-event"))) g_opt.waitEvent = v;
    else if (lstrcmpW(a, L"--no-topmost") == 0) g_opt.topmost = FALSE;
    else if (lstrcmpW(a, L"--taskbar") == 0) g_opt.showTaskbar = TRUE;
    else if (lstrcmpW(a, L"--allow-close") == 0) g_opt.allowClose = TRUE;
  }
  /* LocalFree(argv); Do not free if we define g_opt members pointing to argv strings?
     Wait, CommandLineToArgvW allocates a single block. If we rely on pointers into it, we strictly shouldn't free it
     until we are done with the strings. Original code freed it immediately, which is technically Unsafe
     if we point g_opt.title to it. But usually the memory persists or we get lucky?
     Actually, CommandLinetoArgvW returns a block. If we free it, pointers become dangling.
     The previous code calling LocalFree(argv) was BUGGY if g_opt used pointers into it!
     However `GetArgValue` returns pointer into `arg` which is `argv[i]`.
     So we MUST NOT free argv if we use the strings directly.
     Let's leak `argv` (it's small and process lives shortly) or keep reference. */
}

static DWORD WINAPI WaitThread(LPVOID p) {
  HWND h = (HWND)p;
  HANDLE e = OpenEventW(SYNCHRONIZE, FALSE, g_opt.waitEvent);
  if (e) {
    WaitForSingleObject(e, INFINITE);
    CloseHandle(e);
    PostMessageW(h, WM_CLOSE, 0, 0);
  }
  return 0;
}

static void CreateFonts() {
  HDC hdc = GetDC(NULL);
  int dpiY = GetDeviceCaps(hdc, LOGPIXELSY);
  LOGFONTW lf = {0};

  lf.lfHeight = -MulDiv(11, dpiY, 72);
  lstrcpyW(lf.lfFaceName, L"Microsoft YaHei UI");
  g_hFont = CreateFontIndirectW(&lf);

  lf.lfHeight = -MulDiv(9, dpiY, 72);
  lf.lfQuality = CLEARTYPE_QUALITY;
  lstrcpyW(lf.lfFaceName, L"Segoe UI");
  g_hTitleFont = CreateFontIndirectW(&lf);

  lf.lfHeight = -MulDiv(11, dpiY, 72);
  lf.lfWeight = FW_THIN;
  g_hCloseFont = CreateFontIndirectW(&lf);

  ReleaseDC(NULL, hdc);
}

static LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
  switch (m) {
    case WM_CREATE: {
      CreateFonts();

      MARGINS dwmM = {1, 1, 1, 1};
      DwmExtendFrameIntoClientArea(h, &dwmM);
      SetWindowPos(h, NULL, 0, 0, 0, 0, SWP_NOZORDER|SWP_NOMOVE|SWP_NOSIZE|SWP_FRAMECHANGED);

      g_rcCloseBtn.left = g_opt.width - 46;
      g_rcCloseBtn.top = 0;
      g_rcCloseBtn.right = g_opt.width;
      g_rcCloseBtn.bottom = 32;

      /* Layout */
      int mx = 30;
      int cw = g_opt.width - 60;
      int contentH = 68; // 26text + 20gap + 22prog
      int ty = 32 + (g_opt.height - 32 - contentH) / 2 - 5;

      HWND ht = CreateWindowExW(0, L"STATIC", g_opt.text, WS_CHILD|WS_VISIBLE|SS_LEFT,
        mx, ty, cw, 26, h, NULL, (HINSTANCE)GetWindowLongPtrW(h, GWLP_HINSTANCE), NULL);
      SendMessageW(ht, WM_SETFONT, (WPARAM)g_hFont, TRUE);

      HWND hp = CreateWindowExW(0, PROGRESS_CLASSW, NULL, WS_CHILD|WS_VISIBLE|PBS_SMOOTH|PBS_MARQUEE,
        mx, ty + 46, cw, 22, h, NULL, (HINSTANCE)GetWindowLongPtrW(h, GWLP_HINSTANCE), NULL);

      /* Start Marquee */
      SendMessageW(hp, PBM_SETMARQUEE, TRUE, (LPARAM)g_opt.speedMs);

      if (g_opt.waitEvent) CreateThread(NULL, 0, WaitThread, h, 0, NULL);
      
      /* Auto Close Timeout (80s) */
      SetTimer(h, 1, 80000, NULL);
      
      return 0;
    }

    case WM_TIMER:
      if (w == 1) {
        KillTimer(h, 1);
        SendMessageW(h, WM_CLOSE, 0, 0);
      }
      return 0;

    /* DWM & Borderless Fixes */
    case WM_NCCALCSIZE: return w ? 0 : DefWindowProcW(h, m, w, l);
    case WM_NCACTIVATE: return TRUE;
    case WM_NCPAINT: return 0;
    case WM_NCHITTEST: {
      LRESULT hit = DefWindowProcW(h, m, w, l);
      return (hit >= HTLEFT && hit <= HTBOTTOMRIGHT) ? HTCLIENT : hit;
    }

    case WM_CTLCOLORSTATIC:
      SetBkMode((HDC)w, TRANSPARENT);
      SetTextColor((HDC)w, COL_TITLE);
      return (LRESULT)GetStockObject(WHITE_BRUSH);

    case WM_PAINT: {
      PAINTSTRUCT ps;
      HDC hdc = BeginPaint(h, &ps);
      RECT rc;
      GetClientRect(h, &rc);

      /* BG & Border */
      FillRect(hdc, &rc, (HBRUSH)GetStockObject(WHITE_BRUSH));
      HBRUSH hb = CreateSolidBrush(COL_BORDER);
      FrameRect(hdc, &rc, hb);
      DeleteObject(hb);

      /* Title */
      if (g_opt.title) {
        HFONT old = (HFONT)SelectObject(hdc, g_hTitleFont);
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, COL_TITLE);
        RECT rt = {15, 0, g_opt.width - 50, 32};
        DrawTextW(hdc, g_opt.title, -1, &rt, DT_LEFT|DT_VCENTER|DT_SINGLELINE|DT_END_ELLIPSIS);
        SelectObject(hdc, old);
      }

      /* Close Btn */
      if (g_opt.allowClose) {
        RECT rb = g_rcCloseBtn;
        HBRUSH hbb = CreateSolidBrush(g_bBtnHover ? COL_BTN_HOVER : RGB(255,255,255));
        FillRect(hdc, &rb, hbb);
        DeleteObject(hbb);

        HFONT oldF = (HFONT)SelectObject(hdc, g_hCloseFont);
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, g_bBtnHover ? COL_BTN_ICON_HOVER : COL_BTN_ICON);
        DrawTextW(hdc, L"\x2715", 1, &rb, DT_CENTER|DT_VCENTER|DT_SINGLELINE);
        SelectObject(hdc, oldF);
      }
      EndPaint(h, &ps);
      return 0;
    }

    case WM_MOUSEMOVE: {
      POINT pt = {GET_X_LPARAM(l), GET_Y_LPARAM(l)};
      BOOL hover = PtInRect(&g_rcCloseBtn, pt);
      if (hover != g_bBtnHover) {
        g_bBtnHover = hover;
        InvalidateRect(h, &g_rcCloseBtn, FALSE);
        if (hover) {
          TRACKMOUSEEVENT t = {sizeof(t), TME_LEAVE, h, 0};
          TrackMouseEvent(&t);
        }
      }
      return 0;
    }
    case WM_MOUSELEAVE:
      if (g_bBtnHover) {
        g_bBtnHover = FALSE;
        InvalidateRect(h, &g_rcCloseBtn, FALSE);
      }
      return 0;

    case WM_LBUTTONDOWN: {
      POINT pt = {GET_X_LPARAM(l), GET_Y_LPARAM(l)};
      if (PtInRect(&g_rcCloseBtn, pt) && g_opt.allowClose) {
        g_bBtnDown = TRUE;
        SetCapture(h);
      } else if (pt.y < 32) {
        ReleaseCapture(); // Ensure no capture before drag
        SendMessageW(h, WM_NCLBUTTONDOWN, HTCAPTION, 0);
      }
      return 0;
    }
    case WM_LBUTTONUP:
      if (g_bBtnDown) {
        POINT pt = {GET_X_LPARAM(l), GET_Y_LPARAM(l)};
        g_bBtnDown = FALSE;
        ReleaseCapture();
        if (PtInRect(&g_rcCloseBtn, pt)) SendMessageW(h, WM_CLOSE, 0, 0);
      }
      return 0;

    case WM_CLOSE:
      if (!g_opt.allowClose && !g_opt.waitEvent) return 0;
      DestroyWindow(h);
      return 0;

    case WM_DESTROY:
      if (g_hFont) DeleteObject(g_hFont);
      if (g_hTitleFont) DeleteObject(g_hTitleFont);
      if (g_hCloseFont) DeleteObject(g_hCloseFont);
      PostQuitMessage(0);
      return 0;
  }
  return DefWindowProcW(h, m, w, l);
}

int WINAPI wWinMain(HINSTANCE h, HINSTANCE px, PWSTR cmd, int s) {
  InitArgs();

  INITCOMMONCONTROLSEX icc = {sizeof(icc), ICC_PROGRESS_CLASS};
  InitCommonControlsEx(&icc);

  WNDCLASSEXW wc = {sizeof(wc), CS_HREDRAW|CS_VREDRAW, WndProc, 0, 0, h, LoadIconW(h, MAKEINTRESOURCEW(IDI_ICON1)), LoadCursorW(NULL, IDC_ARROW), (HBRUSH)GetStockObject(WHITE_BRUSH), NULL, L"InnoUpdaterStubWnd", LoadIconW(h, MAKEINTRESOURCEW(IDI_ICON1))};
  RegisterClassExW(&wc);

  DWORD exStyle = (g_opt.topmost ? WS_EX_TOPMOST : 0) | (g_opt.showTaskbar ? WS_EX_APPWINDOW : WS_EX_TOOLWINDOW);
  HWND hWnd = CreateWindowExW(exStyle, L"InnoUpdaterStubWnd", g_opt.title, WS_POPUP|WS_THICKFRAME|WS_SYSMENU|WS_VISIBLE,
    CW_USEDEFAULT, CW_USEDEFAULT, g_opt.width, g_opt.height, NULL, NULL, h, NULL);

  /* Center */
  RECT rc; GetWindowRect(hWnd, &rc);
  int sw = GetSystemMetrics(SM_CXSCREEN), sh = GetSystemMetrics(SM_CYSCREEN);
  SetWindowPos(hWnd, NULL, (sw-(rc.right-rc.left))/2, (sh-(rc.bottom-rc.top))/2, 0, 0, SWP_NOSIZE|SWP_NOZORDER|SWP_NOACTIVATE);

  MSG msg;
  while (GetMessageW(&msg, NULL, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  return 0;
}

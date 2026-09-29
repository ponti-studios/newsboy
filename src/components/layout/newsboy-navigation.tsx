import { Popover, PopoverContent, PopoverTrigger } from "@ponti-studios/ui/overlays";
import { LucideChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";

import { BRAND_NAME } from "~/config/brand";

export interface NavigationGame {
  slug: string;
  name: string;
}

export interface NewsboyNavigationProps {
  games: NavigationGame[];
  signedIn: boolean;
  canAccessAdmin: boolean;
  loginUrl: string;
}

export function getCurrentGame(pathname: string, games: readonly NavigationGame[]) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return games.find((game) => game.slug === firstSegment) ?? null;
}

export function NewsboyNavigation({
  games,
  signedIn,
  canAccessAdmin,
  loginUrl,
}: NewsboyNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentGame = getCurrentGame(location.pathname, games);
  const isHistory = location.pathname === "/history";
  const isAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const hasSelectedGame = currentGame !== null;

  return (
    <header
      className="sticky top-0 z-50 bg-transparent px-4 pb-3"
      style={{ paddingTop: "var(--game-gutter-top)" }}
    >
      <nav
        aria-label={`${BRAND_NAME} navigation`}
        className="bg-game-ink text-game-paper mx-auto flex min-h-15 max-w-5xl items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-lg"
      >
        <Link to="/" aria-label={`${BRAND_NAME} home`}>
          <img className="h-8 w-auto" src="/newsboy-logo.png" alt="" />
        </Link>

        {games.length === 1 ? (
          <ul className="flex items-center gap-2">
            <li>
              <Link
                to={`/${games[0].slug}`}
                aria-current={currentGame?.slug === games[0].slug ? "page" : undefined}
                className="text-game-paper/65 hover:bg-game-paper/12 hover:text-game-paper aria-[current=page]:bg-game-paper/12 aria-[current=page]:text-game-paper rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                Play
              </Link>
            </li>
          </ul>
        ) : games.length > 1 ? (
          <Popover>
            <PopoverTrigger
              className="border-game-paper/18 bg-game-paper/10 text-game-paper hover:bg-game-paper/18 inline-flex min-h-9 items-center gap-2 rounded-xl border px-2.5 py-2 text-sm leading-none font-semibold"
              aria-label={hasSelectedGame ? `Current game: ${currentGame?.name}` : "Choose a game"}
            >
              <span>{currentGame?.name ?? "Games"}</span>
              <span aria-hidden="true">
                <LucideChevronDown className="size-4" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-2xs rounded-xl p-2" sideOffset={20}>
              <p className="text-muted-foreground m-0 px-2.5 pt-1.5 pb-1 text-[0.6875rem] font-extrabold tracking-[0.14em] uppercase">
                Games
              </p>
              <div className="grid gap-0.5">
                {games.map((game) => (
                  <button
                    key={game.slug}
                    type="button"
                    aria-current={currentGame?.slug === game.slug ? "page" : undefined}
                    onClick={() => void navigate(`/${game.slug}`)}
                    className="text-foreground hover:bg-muted aria-[current=page]:bg-muted flex w-full flex-col items-start gap-0.5 rounded-lg bg-transparent p-2.5 text-left"
                  >
                    <span>{game.name}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        <ul className="ml-auto flex items-center gap-2">
          <li>
            <Link
              to="/history"
              aria-current={isHistory ? "page" : undefined}
              className="text-game-paper/65 hover:bg-game-paper/12 hover:text-game-paper aria-[current=page]:bg-game-paper/12 aria-[current=page]:text-game-paper rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              History
            </Link>
          </li>
          {canAccessAdmin && (
            <li>
              <Link
                to="/admin"
                aria-current={isAdmin ? "page" : undefined}
                className="text-game-paper/65 hover:bg-game-paper/12 hover:text-game-paper aria-[current=page]:bg-game-paper/12 aria-[current=page]:text-game-paper rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                Admin
              </Link>
            </li>
          )}
        </ul>

        {!signedIn && (
          <a
            href={loginUrl}
            className="border-game-paper/18 bg-game-paper/10 text-game-paper hover:bg-game-paper/18 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
          >
            Sign in
          </a>
        )}
      </nav>
    </header>
  );
}

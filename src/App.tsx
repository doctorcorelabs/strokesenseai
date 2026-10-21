import { useEffect, useRef, useState } from 'react';
import { FEATURE_GROUPS, getFeature } from '../shared/registry';
import { MODE_LABELS } from './components/ui';
import { setPendingGroup } from './nav-target';
import HomePage from './pages/Home';
import LabPage from './pages/LabPage';
import FastPage from './pages/Fast';
import EmergencyPage from './pages/Emergency';
import ScopePage from './pages/Scope';

type Route =
  | { page: 'home' }
  | { page: 'lab'; id: string }
  | { page: 'fast' }
  | { page: 'emergency' }
  | { page: 'about' };

function currentRoute(): Route {
  const [head, id] = window.location.hash.replace(/^#\/?/, '').split('/');
  switch (head) {
    case '':
    case 'home':
      return { page: 'home' };
    case 'lab':
      return id ? { page: 'lab', id } : { page: 'home' };
    case 'fast':
      return { page: 'fast' };
    case 'emergency':
      return { page: 'emergency' };
    case 'about':
      return { page: 'about' };
    default:
      return { page: 'home' };
  }
}

function routeTitle(route: Route): string {
  switch (route.page) {
    case 'lab': {
      const feature = getFeature(route.id);
      return feature ? feature.name : 'Lab not found';
    }
    case 'fast':
      return 'FAST check';
    case 'emergency':
      return 'Emergency help in Indonesia';
    case 'about':
      return 'Scope and privacy';
    default:
      return 'Experimental AI Lab';
  }
}

const navigation: { hash: string; title: string; page: Route['page'] }[] = [
  { hash: '#home', title: 'Labs', page: 'home' },
  { hash: '#fast', title: 'FAST', page: 'fast' },
  { hash: '#emergency', title: 'Emergency', page: 'emergency' },
  { hash: '#about', title: 'Scope', page: 'about' },
];

function groupLabel(group: unknown): string {
  if (typeof group === 'string') return group;
  const record = group as { title?: string; name?: string; id?: string };
  return record.title ?? record.name ?? record.id ?? 'Labs';
}

/** The id of a group's section heading on the Home page. */
function groupSectionId(group: string): string {
  return `group-${group.replace(/\s+/g, '-')}`;
}

/**
 * Footer group shortcut. If the Home sections are already on screen, scroll
 * straight to the group without touching the hash (a hash change would make
 * the router reset scroll to the top). Otherwise record the target so Home
 * can scroll to it once it mounts.
 */
function goToGroup(event: { preventDefault: () => void }, groupId: string): void {
  const element = document.getElementById(groupId);
  if (element) {
    event.preventDefault();
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    setPendingGroup(groupId);
  }
}

function BrandSymbol() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h4l2.5-6 4 12 2.5-6H21"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [menu, setMenu] = useState(false);
  const main = useRef<HTMLElement>(null);
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());

  useEffect(() => {
    function changed() {
      setRoute(currentRoute());
      setMenu(false);
      window.scrollTo?.({ top: 0, behavior: 'instant' as ScrollBehavior });
      main.current?.focus({ preventScroll: true });
    }
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);

  useEffect(() => {
    document.title = `StrokeSense AI Lab - ${routeTitle(route)}`;
  }, [route]);

  const activePage = route.page === 'lab' ? 'home' : route.page;

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="top-bar">
        <span>Experimental AI learning lab. Not a diagnosis.</span>
        <span>{MODE_LABELS[apiConfigured ? 'live' : 'offline']}</span>
      </div>
      <header className="site-header">
        <a
          className="brand"
          href="#home"
          aria-label="StrokeSense AI Lab - Experimental AI for Stroke Learning - home"
        >
          <span className="brand-symbol">
            <BrandSymbol />
          </span>
          <span className="brand-text">
            <span className="brand-name">
              StrokeSense <span>AI Lab</span>
            </span>
            <small>EXPERIMENTAL AI FOR STROKE LEARNING</small>
          </span>
        </a>
        <nav
          className={`main-nav ${menu ? 'open' : ''}`}
          aria-label="Main navigation"
          id="main-navigation"
        >
          {navigation.map((item) => (
            <a
              href={item.hash}
              key={item.hash}
              className={activePage === item.page ? 'active' : ''}
              aria-current={activePage === item.page ? 'page' : undefined}
            >
              {item.title}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a
            className="header-emergency"
            href="tel:119"
            aria-label="Call 119 - emergency number in Indonesia"
          >
            Call 119
          </a>
          <button
            className="menu-toggle icon-button"
            type="button"
            aria-label={menu ? 'Close menu' : 'Open menu'}
            aria-expanded={menu}
            aria-controls="main-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? 'Close' : 'Menu'}
          </button>
        </div>
      </header>
      <main
        id="main-content"
        ref={main}
        tabIndex={-1}
        className={`site-main ${route.page !== 'home' ? 'inner-main' : ''}`}
      >
        {route.page === 'lab' ? (
          <LabPage key={route.id} id={route.id} />
        ) : route.page === 'fast' ? (
          <FastPage />
        ) : route.page === 'emergency' ? (
          <EmergencyPage />
        ) : route.page === 'about' ? (
          <ScopePage />
        ) : (
          <HomePage />
        )}
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <a className="brand" href="#home">
              <span className="brand-symbol">
                <BrandSymbol />
              </span>
              <span className="brand-text">
                <span className="brand-name">
                  StrokeSense <span>AI Lab</span>
                </span>
              </span>
            </a>
            <p>
              Explore how AI measures signals related to stroke.
              <br />
              An experimental lab for learning, not diagnosing.
            </p>
          </div>
          <div className="footer-links">
            {FEATURE_GROUPS.map((group) => {
              const label = groupLabel(group);
              const targetId = groupSectionId(label);
              return (
                <a
                  href="#home"
                  key={label}
                  onClick={(event) => goToGroup(event, targetId)}
                >
                  {label}
                </a>
              );
            })}
            <a href="#fast">Manual FAST check</a>
            <a href="#emergency">Emergency help</a>
            <a href="#about">Scope and privacy</a>
          </div>
          <a className="footer-emergency" href="tel:119">
            <span>
              Possible stroke?
              <strong>Call 119 in Indonesia.</strong>
            </span>
          </a>
        </div>
        <div className="footer-bottom">
          <p>General education only. AI may be wrong. Do not delay emergency care.</p>
          <span>Synthetic samples. Transparent limits. No diagnosis.</span>
        </div>
      </footer>
    </>
  );
}

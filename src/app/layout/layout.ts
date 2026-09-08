import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';

interface INavItem {
  label: string;
  route: string;
  activeIcon: string;
  inactiveIcon: string;
}

/**
 * Admin shell per the Figma: light sidebar with the full nav, topbar with
 * platform name + profile. Items without a built page land on the stub route.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly account = this.auth.account;

  /**
   * Whether the routed page owns the viewport.
   *
   * Every other admin page is a document that scrolls inside the shell's
   * padding. The support desk is an application: two panes that scroll
   * internally, which need a definite height and no padding around them.
   * Declared by the route so adding a second such page changes nothing here.
   */
  readonly fullBleed = signal<boolean>(false);

  constructor() {
    this.readFullBleed();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.readFullBleed());
  }

  private readFullBleed(): void {
    let node: ActivatedRoute | null = this.route;
    let wants = false;
    while (node) {
      // `snapshot` is not populated on a child route until the navigation that
      // activates it has finished, and this runs once before that.
      if (node.snapshot?.data?.['fullBleed'] === true) wants = true;
      node = node.firstChild;
    }
    this.fullBleed.set(wants);
  }

  readonly nav: INavItem[] = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      activeIcon: 'icons/menu/dashboard-active.svg',
      inactiveIcon: 'icons/menu/dashboard-inactive.svg',
    },
    {
      label: 'Schools',
      route: '/schools',
      activeIcon: 'icons/menu/result-management-active.svg',
      inactiveIcon: 'icons/menu/result-management-inactive.svg',
    },
    {
      label: 'Faculty',
      route: '/faculty',
      activeIcon: 'icons/menu/history-active.svg',
      inactiveIcon: 'icons/menu/history-inactive.svg',
    },
    {
      label: 'Courses',
      route: '/courses',
      activeIcon: 'icons/menu/courses-active.svg',
      inactiveIcon: 'icons/menu/courses-inactive.svg',
    },
    {
      label: 'Department',
      route: '/department',
      activeIcon: 'icons/menu/payment-history-active.svg',
      inactiveIcon: 'icons/menu/payment-history-inactive.svg',
    },
    {
      label: 'Lecturers',
      route: '/lecturers',
      activeIcon: 'icons/menu/my-result-active.svg',
      inactiveIcon: 'icons/menu/my-result-inactive.svg',
    },
    {
      label: 'Students',
      route: '/students',
      activeIcon: 'icons/menu/students-active.svg',
      inactiveIcon: 'icons/menu/students-inactive.svg',
    },
    {
      label: 'Admins',
      route: '/admins',
      activeIcon: 'icons/menu/dues-management-active.svg',
      inactiveIcon: 'icons/menu/dues-management-inactive.svg',
    },
    {
      label: 'Logs',
      route: '/logs',
      activeIcon: 'icons/menu/result-chart-active.svg',
      inactiveIcon: 'icons/menu/result-chart-inactive.svg',
    },
    {
      label: 'Registration',
      route: '/registration',
      activeIcon: 'icons/menu/result-management-active.svg',
      inactiveIcon: 'icons/menu/result-management-inactive.svg',
    },
    {
      label: 'Support',
      route: '/support',
      activeIcon: 'icons/menu/messages-active.svg',
      inactiveIcon: 'icons/menu/messages-inactive.svg',
    },
    {
      label: 'Settings',
      route: '/settings',
      activeIcon: 'icons/menu/settings-active.svg',
      inactiveIcon: 'icons/menu/settings-inactive.svg',
    },
  ];

  fullName(): string {
    const acc = this.account();
    return acc ? `${acc.firstname} ${acc.lastname}` : '';
  }

  logout(): void {
    this.auth.signOut();
  }
}

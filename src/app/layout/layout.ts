import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

  readonly account = this.auth.account;

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

=== Central de Comunicações BVA ===
Contributors: calvas-fire
Tags: dashboard, emergency, communications
Requires at least: 6.2
Tested up to: 7.1
Requires PHP: 8.0
Stable tag: 0.4.4
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Authenticated operations dashboard for hospital service constraints, special readiness levels, and operational notices.

== Description ==

BVA Communications Centre provides a dashboard and a restricted back office for managing operational information.

The dashboard groups hospital constraints by hospital, displays readiness levels and operational notices, and includes a clock and a short local weather forecast. Hospital constraints become visible one hour before their scheduled start and are hidden at their end time.

Use the [bva_central] shortcode on a WordPress page. Visitors must be authenticated WordPress users. Administrators and users granted the edit_bva_central capability can manage records and dropdown catalogs.

== Installation ==

1. Upload the plugin ZIP through Plugins > Add New Plugin > Upload Plugin.
2. Activate BVA Communications Centre.
3. Create a page and add the [bva_central] shortcode.
4. Sign in to WordPress to view the page. Grant editing access from Users > BVA Central Access.

== Frequently Asked Questions ==

= Does the dashboard require an account? =

Yes. A WordPress account is required to view the dashboard. Editing also requires an administrator account or the plugin's editing capability.

= Does weather forecasting require internet access? =

Yes. The weather block retrieves the forecast from Open-Meteo.

== Changelog ==

= 0.4.4 =
* Make group date-time and normal date/time fields optional alternatives, validate and synchronize them on save, and show group date-time first.

= 0.4.3 =
* Rename the readiness command to Comando Sub Regional de Lisboa.
* Add synchronized local date/time and group date-time entry and keep both formats visible for the readiness period.

= 0.4.2 =
* Fix record type mapping so saved hospital constraints and operational notices appear in the dashboard and back office.
* Use one sans-serif typeface throughout and improve weather and readiness readability and contrast.

= 0.4.1 =
* Prefix the dashboard template's branding settings variable to follow WordPress naming conventions.

= 0.4.0 =
* Add a per-device dashboard text-size control and enlarge the logo upload area for mobile and tablet use.

= 0.3.0 =
* Add configurable header logo, title, subtitle, colors, and a branding panel in the back office.

= 0.2.1 =
* Escape the editing-permission checkbox state and protect the dashboard template from direct access.
* Prepare table identifiers in SQL queries and add plugin directory metadata.

/**
 * Theme boot — runs before paint to avoid a flash of the wrong theme.
 *
 * The dark class is driven by an explicit user choice stored in localStorage, and
 * falls back to the OS preference. A three-way choice (light / dark / system)
 * matters because "system" must stay live — if the OS flips while the page is
 * open, a system user should see it change.
 */

export const THEME_STORAGE_KEY = "coolspot-theme";

export type ThemeChoice = "light" | "dark" | "system";

export const themeBootScript = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var s=localStorage.getItem(k);
if(s!=="light"&&s!=="dark"&&s!=="system")s="system";
var m=window.matchMedia("(prefers-color-scheme: dark)");
var apply=function(){var d=s==="dark"||(s==="system"&&m.matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";};
apply();
m.addEventListener("change",function(){if(s==="system")apply();});
}catch(e){}})();`;

import {Link} from '@tanstack/react-router'
const linkClass='inline-flex min-h-11 items-center border-b-2 px-4 py-2 text-sm font-semibold'
const activeClass='border-ink text-ink'
const inactiveClass='border-transparent text-ink/65 hover:border-ink/30 hover:text-ink'
export function MoneyViews({active}:{active:'budgets'|'records'}) {
 return <nav aria-label="Money views" className="flex flex-wrap border-b border-border"><Link to="/app/budgets" className={`${linkClass} ${active==='budgets'?activeClass:inactiveClass}`} aria-current={active==='budgets'?'page':undefined}>Budgets</Link><Link to="/app/wallet" search={{highlight:undefined}} className={`${linkClass} ${active==='records'?activeClass:inactiveClass}`} aria-current={active==='records'?'page':undefined}>Payments &amp; IOUs</Link></nav>
}
export function ScheduleViews({active}:{active:'calendar'|'timeline'}) {
 return <nav aria-label="Schedule views" className="flex flex-wrap border-b border-border"><Link to="/app/calendar" className={`${linkClass} ${active==='calendar'?activeClass:inactiveClass}`} aria-current={active==='calendar'?'page':undefined}>Calendar</Link><Link to="/app/gantt" className={`${linkClass} ${active==='timeline'?activeClass:inactiveClass}`} aria-current={active==='timeline'?'page':undefined}>Timeline</Link></nav>
}
export function navSection(path:string){if(path==='/app/wallet'||path==='/app/budgets')return '/app/budgets';if(path==='/app/gantt'||path==='/app/calendar')return '/app/calendar';return path}

import '../test-setup'
import {vi,it,expect,afterEach} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import type {ReactNode} from 'react'
vi.mock('@/components/layout',()=>({appRoute:{}}))
vi.mock('@tanstack/react-router',()=>({createRoute:()=>({}),Link:({children,...props}:{children:ReactNode})=><a {...props}>{children}</a>}))
vi.mock('@/hooks/useAppStore',()=>({useAppStore:()=>({session:{user:{id:'test'}}})}))
vi.mock('@/lib/projects',()=>({fetchProjects:async()=>[],createMilestone:vi.fn(),createTask:vi.fn()}))
vi.mock('@/lib/coordination-objects',()=>({fetchCoordinationObjects:async()=>[]}))
vi.mock('@/lib/calendar',async(importOriginal)=>({...await importOriginal<typeof import('@/lib/calendar')>(),fetchAllCalendarEvents:async()=>[],fetchExceptionsForEvents:async()=>[]}))
import {CalendarPage} from './calendar'
import {navSection} from '@/components/section-views'
afterEach(cleanup)
it('opens the event form on demand, focuses it and closes it without saving',async()=>{
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><CalendarPage/></QueryClientProvider>)
 expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'New event'}))
 expect(screen.getByLabelText('Title')).toHaveFocus()
 expect(screen.getByRole('button',{name:'New event'})).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Draft event'}})
 fireEvent.click(screen.getByRole('button',{name:'Close'}))
 expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'New event'}))
 expect(screen.getByLabelText('Title')).toHaveValue('')
})
it('keeps the section selected for legacy money and timeline links',()=>{
 expect(navSection('/app/wallet')).toBe('/app/budgets')
 expect(navSection('/app/gantt')).toBe('/app/calendar')
 expect(navSection('/app/marketplace')).toBe('/app/marketplace')
})

import {buildTimeline} from './gantt'
it('keeps Today reachable when all timeline items are old or in the future',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-26T12:00:00'))
 try {
  for(const date of ['2026-03-15','2027-02-15']) {
   const timeline=buildTimeline([{id:'test',title:'Plan',startsOn:date,endsOn:date,lane:'Plan',isTask:false,source:'coordination',scheduleMode:'range'}],'comfortable')
   expect(timeline.todayLeft).not.toBeNull()
   expect(timeline.days.some(day=>day.iso==='2026-11-26'&&day.isToday)).toBe(true)
   expect(timeline.days.some(day=>day.iso===date)).toBe(true)
  }
 } finally {vi.useRealTimers()}
})

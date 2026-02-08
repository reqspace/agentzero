'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-orange data-[state=checked]:border-orange data-[state=unchecked]:bg-bg-4',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-3.5 w-3.5 rounded-full bg-text-1 shadow-sm transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]'
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

export { Switch }

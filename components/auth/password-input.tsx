"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { cn } from "cn"
import { Input } from "@/components/ui/input"

// Password field with a show/hide toggle inside it. The toggle is type="button",
// so it never submits the form.
export function PasswordInput({ id, className, ...props }: Omit<React.ComponentProps<typeof Input>, "type"> & { id: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input id={id} type={visible ? "text" : "password"} className={cn("h-10 pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

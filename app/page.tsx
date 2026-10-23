import { ListChecks, MapPin, ShieldCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { ExampleAnswer } from "@/components/landing/example-answer"
import { LandingNav } from "@/components/landing/landing-nav"
import { LandingFooter } from "@/components/landing/landing-footer"
import { PublicAsk } from "@/components/landing/public-ask"
import { HowItWorksSteps } from "@/components/shared/how-it-works-steps"
import { getCurrentProfile, homePathFor } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { readGuestQuota, remainingQuestions } from "@/lib/guest-quota"

// Questions incoming freshmen and visitors ask first.
const SUGGESTIONS = [
  "How do I apply for admission?",
  "What programs does CECT offer?",
  "What are the freshman requirements?",
  "Where is the Registrar?",
  "Are there any new university announcements?",
]

const SOURCES = [
  { image: "/assets/handbook.png", name: "Student Handbook", use: "Academic rules, policies and procedures" },
  { image: "/assets/memo.png", name: "Official Memos and Policies", use: "Updated processes, reviewed by university staff" },
  { image: "/assets/campus.png", name: "Campus / Office Information", use: "Which office handles what, and where it is" },
  { image: "/assets/calendar.png", name: "Academic Calendar", use: "Enrollment, exams and university dates" },
]

const ABOUT_POINTS = [
  { icon: ShieldCheck, title: "Reliable information", body: "Uses university-approved sources." },
  { icon: ListChecks, title: "Clear guidance", body: "Turns complex procedures into understandable steps." },
  { icon: MapPin, title: "Campus navigation", body: "Helps you find offices, buildings and essential university information." },
]

export default async function LandingPage() {
  const [{ assistantName }, profile, quota] = await Promise.all([getBranding(), getCurrentProfile(), readGuestQuota()])
  // Signed-in users have no limit; guests see how many free questions are left.
  const remaining = profile ? null : remainingQuestions(quota)

  return (
    <div className="landing-page flex flex-1 flex-col bg-[linear-gradient(to_bottom,var(--canvas)_0_100svh,var(--background)_100svh)] [--landing-header-space:88px] sm:[--landing-header-space:104px] [&>footer]:bg-white">
      <LandingNav floating account={profile ? { homeHref: homePathFor(profile.role) } : null} />

      <main className="flex-1">
        {/* Hero: centered headline and the public ask box */}
        <section className="flex min-h-[calc(100svh-var(--landing-header-space))] flex-col justify-center border-b bg-[var(--canvas)]">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-8 text-center sm:px-6 sm:py-10">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">For freshmen and visitors</p>
            <h1 className="mt-4 text-4xl leading-[1.1] font-bold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[3.5rem]">
              <span className="text-foreground">Got Questions?</span>{" "}
              <span className="text-primary sm:block">Ask CECT Agent.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Your AI-powered campus companion, making university information easier to find, understand, and explore.
            </p>

            <div className="mt-9 w-full text-left">
              <PublicAsk suggestions={SUGGESTIONS} initialRemaining={remaining} />
            </div>

            {profile ? (
              <p className="mt-5 text-sm text-muted-foreground">
                You&apos;re signed in.{" "}
                <Link href="/app" className="font-medium text-primary underline-offset-4 hover:underline">
                  Open {assistantName}
                </Link>{" "}
                to save your conversations.
              </p>
            ) : null}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-28 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Built to guide, not to guess</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                School processes are spread across handbooks, memos and office notices. {assistantName} brings them
                together and answers with structure.
              </p>
            </div>
            <HowItWorksSteps
              className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8"
              askExample="“How do I apply for admission?” or “Where is the Registrar?”"
            />
            <div className="mx-auto mt-14 max-w-xl">
              <ExampleAnswer />
            </div>
          </div>
        </section>

        {/* Verified sources */}
        <section id="sources" className="scroll-mt-28 border-t bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Reliable sources</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                University staff decide what {assistantName} knows. Guides are reviewed before they are published, and
                every school-specific answer shows where it came from.
              </p>
            </div>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SOURCES.map(({ image, name, use }) => (
                <li key={name} className="grid h-[420px] grid-rows-[3fr_2fr] rounded-[20px] border border-slate-200/80 bg-white shadow-[0_6px_24px_-12px_oklch(0.24_0.07_264/0.18)]">
                  <div className="relative min-h-0">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 290px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-contain p-3"
                    />
                  </div>
                  <div className="px-6 pt-2 pb-6">
                    <h3 className="min-h-13 text-lg leading-[1.45] font-semibold tracking-[-0.02em] text-foreground">{name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{use}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
              When no reliable source exists, it says so:{" "}
              <span className="text-foreground">“I couldn&apos;t find a reliable university source for this yet.”</span>
            </p>
          </div>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-28 border-t bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:py-24">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">About</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">About {assistantName}</h2>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                {assistantName} is an AI-powered university information and process navigator designed primarily for
                freshmen and campus visitors. It turns admission steps, policies, campus information and
                official references into clear guidance that is easier to understand and follow.
              </p>
            </div>
            <ul className="divide-y rounded-lg border bg-background shadow-[0_1px_2px_oklch(0.3_0.05_260/0.05)]">
              {ABOUT_POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-4 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <LandingFooter assistantName={assistantName} />
    </div>
  )
}

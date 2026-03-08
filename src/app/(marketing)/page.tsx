import { HeroSection } from "@/components/marketing/hero"
import { FeaturesSection } from "@/components/marketing/features"
import { HowItWorksSection } from "@/components/marketing/how-it-works"
import { CTASection } from "@/components/marketing/cta"

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
    </>
  )
}

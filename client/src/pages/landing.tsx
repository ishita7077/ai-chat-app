import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [showSecondBubble, setShowSecondBubble] = useState(false);
  const [showThirdBubble, setShowThirdBubble] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setShowSecondBubble(true), 1000);
    const timer2 = setTimeout(() => setShowThirdBubble(true), 2000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="landing-page">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-12 py-4 border-b">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent">
              PitchCraft
            </h1>
            <span className="text-sm text-muted-foreground">beta</span>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">
                About
              </a>
            </nav>
            <ThemeToggle />
          </div>
        </header>

        {/* Hero Section */}
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent animate-gradient">
            Perfect Your Pitch
            <br />
            with AI Intelligence
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Get expert pitch feedback from Rebecca, your AI venture capitalist.
            Experience natural conversations with voice interaction.
          </p>
          <Button 
            size="lg" 
            onClick={() => setLocation("/chat")}
            className="transform hover:scale-105 transition-all duration-300 
                     bg-primary hover:bg-primary/90 
                     shadow-[0_0_15px_rgba(var(--primary),0.2)] 
                     hover:shadow-[0_0_30px_rgba(var(--primary),0.4)] 
                     rounded-full px-12 py-8 text-xl font-semibold"
          >
            Start Your Pitch
          </Button>
        </div>

        {/* Demo Chat Bubbles */}
        <div className="max-w-2xl mx-auto mb-16 relative min-h-[300px] px-4">
          <div className="message-bubble message-bubble-ai opacity-0 animate-fadeIn max-w-[70%]">
            Hi, I'm Rebecca Welton. I've been an early-stage investor since 2017, specializing in Web3 startups. 
            I'd love to hear about your project.
          </div>

          {showSecondBubble && (
            <div className="message-bubble message-bubble-user mt-4 opacity-0 animate-fadeIn max-w-[60%] ml-auto">
              Thanks for having me! I've got a DeFi platform I'd love to discuss.
            </div>
          )}

          {showThirdBubble && (
            <div className="message-bubble message-bubble-ai mt-4 opacity-0 animate-fadeIn max-w-[70%]">
              Perfect! Tell me about your target market and what problem you're solving. 
              And don't worry about the pitch being perfect - that's what I'm here for.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
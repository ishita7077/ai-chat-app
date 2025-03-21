import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [showSecondBubble, setShowSecondBubble] = useState(false);
  const [showThirdBubble, setShowThirdBubble] = useState(false);
  const [showFourthBubble, setShowFourthBubble] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setShowSecondBubble(true), 1000);
    const timer2 = setTimeout(() => setShowThirdBubble(true), 2000);
    const timer3 = setTimeout(() => setShowFourthBubble(true), 3000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="landing-page">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-20 py-6 border-b">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent">
              PitchCraft
            </h1>
            <span className="text-sm text-muted-foreground">beta</span>
          </div>
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex gap-8">
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
        <div className="text-center mb-24">
          <h2 className="text-6xl md:text-7xl font-bold mb-8">
            Make them{" "}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent animate-gradient glow-text">
              believe
            </span>
          </h2>
          <p className="text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            A good pitch is part science, part magic.
            <br />
            Let's get both right.
          </p>
          <Button 
            size="lg" 
            onClick={() => setLocation("/chat")}
            className="transform hover:scale-105 transition-all duration-300 
                     bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-500
                     shadow-[0_0_20px_rgba(var(--primary),0.3)] 
                     hover:shadow-[0_0_40px_rgba(var(--primary),0.5)] 
                     rounded-full px-12 py-8 text-xl font-semibold
                     animate-pulse-subtle"
          >
            Start Your Pitch
          </Button>
        </div>

        {/* Demo Chat Bubbles */}
        <Card className="max-w-2xl mx-auto mb-16 p-8 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md">
          <div className="message-bubble message-bubble-user opacity-0 animate-fadeIn max-w-[70%] ml-auto">
            We're building a decentralized content platform where creators own 100% of their revenue.
          </div>

          {showSecondBubble && (
            <div className="message-bubble message-bubble-ai mt-4 opacity-0 animate-fadeIn max-w-[70%]">
              Sounds nice, but why would creators leave platforms that already give them discovery and stability?
            </div>
          )}

          {showThirdBubble && (
            <div className="message-bubble message-bubble-user mt-4 opacity-0 animate-fadeIn max-w-[70%] ml-auto">
              Web3-native creators want full control—no algorithmic throttling, no 30% platform cuts.
            </div>
          )}

          {showFourthBubble && (
            <div className="message-bubble message-bubble-ai mt-4 opacity-0 animate-fadeIn max-w-[70%]">
              Cool, but without built-in audiences, your biggest problem isn't monetization—it's distribution.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { speechHandler } from "@/lib/speech";
import type { Message } from "@shared/schema";

export default function Home() {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        role: "user",
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setInput("");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const clearChat = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/messages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage.mutate(input);
  };

  const toggleListening = () => {
    if (isListening) {
      speechHandler.stopListening();
      setIsListening(false);
    } else {
      speechHandler.startListening(
        (text) => {
          setInput(text);
          sendMessage.mutate(text);
        },
        (error) => {
          setIsListening(false);
          toast({ 
            variant: "destructive", 
            title: "Speech Recognition Error", 
            description: error 
          });
        }
      );
      setIsListening(true);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 h-screen flex flex-col">
      <Card className="flex-1 flex flex-col p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">AI Chat Assistant</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => clearChat.mutate()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleListening}
            disabled={!speechHandler.isSupported() || sendMessage.isPending}
            className={isListening ? "bg-red-100 hover:bg-red-200" : ""}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button 
            type="submit" 
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
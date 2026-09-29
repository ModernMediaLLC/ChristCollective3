import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Users, Calendar, Lightbulb, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface MembershipTier {
  id: number;
  name: string;
  price: string;
  description: string;
  features: string[];
}

export default function BusinessSection() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  
  // Fetch statistics to get current user count for founding members
  const { data: statistics, isLoading } = useQuery({
    queryKey: ["/api/statistics"],
  });
  
  const totalUsers = (statistics as any)?.communityMembers || 0;

  return (
    <section id="business" className="py-16 bg-black text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Business Network</h2>
          <div className="w-16 h-1 bg-primary mx-auto mb-6"></div>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Connect with other Christian business owners and professionals to grow your network with those who share your values.
          </p>
        </div>
        
        {/* Business Networking Features */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-semibold mb-6">Business Community Features</h3>
            <div className="space-y-8">
              <div className="flex">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center">
                    <Users className="text-white" size={24} />
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-medium mb-2">Targeted Networking</h4>
                  <p className="text-gray-400">Connect with other business owners based on industry, location, and specific business needs.</p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center">
                    <Calendar className="text-white" size={24} />
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-medium mb-2">Events & Webinars</h4>
                  <p className="text-gray-400">Participate in regular virtual and in-person events designed to help you grow your business.</p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-12 h-12 bg-primary/80 rounded-full flex items-center justify-center">
                    <Lightbulb className="text-white" size={24} />
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-medium mb-2">Resource Library</h4>
                  <p className="text-gray-400">Access faith-based business resources, guides, and tools to help you run your business with integrity.</p>
                </div>
              </div>
            </div>
            
            {/* Join Our Growing Network section moved below features */}
            <div className="mt-12">
              <h3 className="text-2xl font-semibold mb-4">Join Our Growing Network</h3>
              <p className="text-gray-400 mb-6">Connect with Christian business owners and professionals across multiple industries worldwide.</p>
              
              <Button 
                asChild
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Link href="/join/business">
                  List Your Business — Free
                </Link>
              </Button>
            </div>
          </div>

          <div>
            <img 
              src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600" 
              alt="Business networking event" 
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

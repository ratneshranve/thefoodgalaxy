import React, { useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  ShieldQuestion,
  Lock,
  UserX,
  CreditCard
} from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"
import { Input } from "@food/components/ui/input"
import { Textarea } from "@food/components/ui/textarea"
import { toast } from "sonner"

import { adminAPI } from "@food/api"

const supportOptions = [
  {
    id: "login",
    title: "Login Issues",
    description: "Can't access your account or OTP issues",
    icon: Lock,
    color: "bg-blue-100 text-blue-600"
  },
  {
    id: "account",
    title: "Account Recovery",
    description: "Recover or deactivate your account",
    icon: UserX,
    color: "bg-purple-100 text-purple-600"
  },
  {
    id: "payment",
    title: "Payment & Refunds",
    description: "Issues with previous transactions",
    icon: CreditCard,
    color: "bg-green-100 text-green-600"
  },
  {
    id: "other",
    title: "Other Questions",
    description: "General inquiries and feedback",
    icon: ShieldQuestion,
    color: "bg-orange-100 text-orange-600"
  }
]

export default function PublicSupport() {
  const [step, setStep] = useState("options")
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  })
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    supportEmail: "rbfoodscorp@gmail.com",
    supportPhone: "9940837039",
    supportHours: "24/7 Availability"
  })

  React.useEffect(() => {
    adminAPI.getPublicBusinessSettings()
      .then(res => {
        const data = res?.data?.data || res?.data
        if (data) {
          setSettings({
            supportEmail: data.supportEmail || "rbfoodscorp@gmail.com",
            supportPhone: data.supportPhone || "+91 9940837039",
            supportHours: data.supportHours || "24/7 Availability"
          })
        }
      })
      .catch(() => null)
  }, [])

  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic)
    setFormData(prev => ({ ...prev, subject: topic.title }))
    setStep("form")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    toast.success("Support request sent! We'll get back to you shortly.")
    setLoading(false)
    setStep("success")
  }

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a] font-['Poppins']">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-12">
          <Link to={-1}>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support Center</h1>
            <p className="text-gray-500 dark:text-gray-400">How can we help you today?</p>
          </div>
        </div>

        {step === "options" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {supportOptions.map((option, idx) => (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-xl transition-all border-none bg-gray-50 dark:bg-[#1a1a1a] group"
                  onClick={() => handleTopicSelect(option)}
                >
                  <CardContent className="p-8 flex items-start gap-6">
                    <div className={`p-4 rounded-2xl ${option.color} group-hover:scale-110 transition-transform`}>
                      <option.icon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">{option.title}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                        {option.description}
                      </p>
                    </div>
                    <ChevronRight className="h-6 w-6 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {step === "form" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="border-none bg-gray-50 dark:bg-[#1a1a1a] p-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedTopic?.color}`}>
                  {selectedTopic && <selectedTopic.icon className="h-5 w-5" />}
                </div>
                {selectedTopic?.title}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input
                      required
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="bg-white dark:bg-[#0a0a0a]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <Input
                      required
                      type="tel"
                      placeholder="+91 1234567890"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="bg-white dark:bg-[#0a0a0a]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    required
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="bg-white dark:bg-[#0a0a0a]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    required
                    rows={5}
                    placeholder="Tell us more about the issue..."
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    className="bg-white dark:bg-[#0a0a0a]"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("options")}
                    className="flex-1 h-12"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 bg-[#7e3866] hover:bg-[#6b2f57]"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
              <MessageCircle className="h-12 w-12" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Request Received!</h2>
            <p className="text-gray-500 max-w-md mx-auto mb-10">
              Our support team has been notified. You will receive an update via email or phone within 24 hours.
            </p>
            <Link to="/">
              <Button className="bg-[#7e3866] hover:bg-[#6b2f57] px-10 h-12">
                Return Home
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Contact Info Footer */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 border-t pt-12 dark:border-gray-800">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
              <Phone className="h-6 w-6 text-[#7e3866]" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Call Us</h4>
              <p className="text-sm text-gray-500">{settings.supportPhone}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
              <Mail className="h-6 w-6 text-[#7e3866]" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Email Us</h4>
              <p className="text-sm text-gray-500">{settings.supportEmail}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
              <Clock className="h-6 w-6 text-[#7e3866]" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Hours</h4>
              <p className="text-sm text-gray-500">{settings.supportHours}</p>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}

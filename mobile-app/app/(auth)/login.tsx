import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { Mail, Lock, ArrowLeft, Check, Shield, Smartphone, Zap } from "lucide-react-native";
import Logo from "../../src/components/Logo";

const { width, height } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [emailValid, setEmailValid] = useState(false);

  // Refs for OTP inputs
  const otpInputs = useRef<Array<TextInput | null>>([]);

  // Animations
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  // Initialize slide animation
  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Email validation with allowed domains
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email.trim());
    
    if (isValidFormat) {
      const allowedDomains = [
        'gmail.com',
        'outlook.com', 
        'hotmail.com',
        'live.com',
        'yahoo.com',
        'yahoo.co.in',
        'edu.in',
        'ac.in',
        'zohomail.in',
        'zohomail.com',
        'proton.me',
        'protonmail.com',
        'outlook.in',
        'icloud.com',
        'rediffmail.com',
        'cc.cc',
        'hbtu.ac.in',
      ];
      
      const domain = email.trim().split('@')[1].toLowerCase();
      const isAllowedDomain = allowedDomains.includes(domain);
      setEmailValid(isAllowedDomain);
    } else {
      setEmailValid(false);
    }
  }, [email]);

  // Timer for resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  async function sendOTP() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    if (!emailValid) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidFormat = emailRegex.test(email.trim());
      
      if (!isValidFormat) {
        Alert.alert("Error", "Please enter a valid email address");
      } else {
        const allowedDomains = [
          'gmail.com', 'outlook.com', 'hotmail.com', 'live.com',
          'yahoo.com', 'yahoo.co.in', 'edu.in', 'ac.in',
          'zohomail.in', 'zohomail.com', 'proton.me', 'protonmail.com',
          'outlook.in', 'icloud.com', 'rediffmail.com'
        ];
        
        Alert.alert(
          "Email Domain Not Allowed",
          "For security and credibility, we only allow emails from:\n\n" +
          "• Gmail (gmail.com)\n" +
          "• Outlook (outlook.com, outlook.in)\n" +
          "• Hotmail (hotmail.com)\n" +
          "• Live (live.com)\n" +
          "• Yahoo (yahoo.com, yahoo.co.in)\n" +
          "• Educational (.edu.in, .ac.in)\n" +
          "• Zoho Mail (zohomail.in, zohomail.com)\n" +
          "• Proton (proton.me, protonmail.com)\n" +
          "• iCloud (icloud.com)\n" +
          "• Rediffmail (rediffmail.com)\n\n" +
          "Please use an email from one of these providers."
        );
      }
      return;
    }

    setLoading(true);

    // Loading animation
    Animated.sequence([
      Animated.timing(scaleAnimation, { toValue: 0.95, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnimation, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
      });

      if (error) throw error;

      // Transition animation
      Animated.parallel([
        Animated.timing(fadeAnimation, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnimation, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setOtpSent(true);
        setResendTimer(60);
        // Reset animations for OTP screen
        fadeAnimation.setValue(1);
        slideAnimation.setValue(1);
        // Focus first OTP input
        setTimeout(() => otpInputs.current[0]?.focus(), 100);
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(value: string, index: number) {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (newOtp.every((digit) => digit !== "") && newOtp.join("").length === 6) {
      verifyOTP(newOtp.join(""));
    }
  }

  function handleOtpKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(text: string) {
    // Extract only digits
    const digits = text.replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];

    for (let i = 0; i < digits.length; i++) {
      newOtp[i] = digits[i];
    }

    setOtp(newOtp);

    // Focus next empty input or last input
    const nextEmptyIndex = newOtp.findIndex((digit) => digit === "");
    if (nextEmptyIndex !== -1) {
      otpInputs.current[nextEmptyIndex]?.focus();
    } else {
      otpInputs.current[5]?.focus();
    }

    // Auto-verify if complete
    if (digits.length === 6) {
      verifyOTP(digits);
    }
  }

  async function verifyOTP(otpCode?: string) {
    const code = otpCode || otp.join("");

    if (code.length !== 6) {
      Alert.alert("Error", "Please enter all 6 digits");
      return;
    }

    setLoading(true);

    // Loading animation
    Animated.timing(scaleAnimation, {
      toValue: 0.95,
      duration: 150,
      useNativeDriver: true,
    }).start();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });

      if (error) throw error;

      // Success animation
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      // Check if user profile exists
      const { data: user } = await supabase.from("users").select("*").eq("id", data.user?.id).single();

      if (!user) {
        // Create user profile
        await supabase.from("users").insert({
          id: data.user?.id,
          email: email.trim().toLowerCase(),
          name: "",
        });
        router.replace("/(auth)/onboarding");
      } else if (!user.branch_id) {
        router.replace("/(auth)/onboarding");
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (error: any) {
      // Error animation
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      // Clear OTP
      setOtp(["", "", "", "", "", ""]);
      otpInputs.current[0]?.focus();

      Alert.alert("Verification Failed", "The code you entered is incorrect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleResendOTP() {
    if (resendTimer > 0) return;
    setOtp(["", "", "", "", "", ""]);
    sendOTP();
  }

  function handleChangeEmail() {
    // Transition animation
    Animated.parallel([
      Animated.timing(fadeAnimation, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnimation, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setOtpSent(false);
      setOtp(["", "", "", "", "", ""]);
      setResendTimer(0);
      // Reset animations
      fadeAnimation.setValue(1);
      slideAnimation.setValue(1);
    });
  }

  const isOtpComplete = otp.every((digit) => digit !== "");

  const openTermsOfService = () => {
    router.push("/legal/terms");
  };

  const openPrivacyPolicy = () => {
    router.push("/legal/privacy");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnimation,
              transform: [
                {
                  translateY: slideAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            {otpSent && (
              <TouchableOpacity style={styles.backButton} onPress={handleChangeEmail}>
                <ArrowLeft color="#0066cc" size={24} />
              </TouchableOpacity>
            )}

            <View style={styles.iconContainer}>
              {otpSent ? (
                <View style={styles.secureIcon}>
                  <Shield color="#52c41a" size={32} />
                </View>
              ) : (
                <View style={styles.logoIcon}>
                  <Logo size="large" variant="minimal" showText={false} />
                </View>
              )}
            </View>

            <Text style={styles.title}>{otpSent ? "Verify Your Email" : "Welcome"}</Text>
            <Text style={styles.subtitle}>
              {otpSent
                ? `Enter the 6-digit code sent to\n${email}`
                : "Continue your academic journey with College Study"}
            </Text>
          </View>

          {!otpSent ? (
            /* Email Input Section */
            <Animated.View style={[styles.inputSection, { transform: [{ scale: scaleAnimation }] }]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={[
                  styles.emailInputWrapper, 
                  emailValid && styles.emailInputValid,
                  !emailValid && email.trim() && email.includes('@') && email.includes('.') ? styles.emailInputInvalid : null
                ]}>
                  <Mail color={emailValid ? "#52c41a" : (!emailValid && email.trim() && email.includes('@') && email.includes('.') ? "#ff4d4f" : "#999")} size={20} />
                  <TextInput
                    style={styles.emailInput}
                    placeholder="your.email@hbtu.ac.in"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!loading}
                    placeholderTextColor="#999"
                  />
                  {emailValid && (
                    <View style={styles.validIcon}>
                      <Check color="#52c41a" size={16} />
                    </View>
                  )}
                </View>
                {!emailValid && email.trim() && email.includes('@') && email.includes('.') && (
                  <Text style={styles.errorMessage}>
                    For your security, please use a trusted email provider
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonLoading, !emailValid && styles.buttonDisabled]}
                onPress={sendOTP}
                disabled={loading || !emailValid}
              >
                <Text style={styles.primaryButtonText}>{loading ? "Sending Code..." : "Send Verification Code"}</Text>
                {!loading && <Zap color="#fff" size={20} />}
              </TouchableOpacity>

              {/* Security Features */}
              <View style={styles.securitySection}>
                <Text style={styles.securityTitle}>Why is this secure?</Text>
                <View style={styles.securityFeatures}>
                  <View style={styles.securityFeature}>
                    <Smartphone color="#0066cc" size={16} />
                    <Text style={styles.securityFeatureText}>No password needed</Text>
                  </View>
                  <View style={styles.securityFeature}>
                    <Shield color="#52c41a" size={16} />
                    <Text style={styles.securityFeatureText}>Encrypted verification</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          ) : (
            /* OTP Input Section */
            <Animated.View style={[styles.inputSection, { transform: [{ scale: scaleAnimation }] }]}>
              <Text style={styles.inputLabel}>Verification Code</Text>
              <Animated.View style={[styles.otpContainer, { transform: [{ translateX: shakeAnimation }] }]}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpInputs.current[index] = ref)}
                    style={[styles.otpInput, digit ? styles.otpInputFilled : {}, loading && styles.otpInputDisabled]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                    textContentType="oneTimeCode"
                  />
                ))}
              </Animated.View>

              {/* Resend Section */}
              <View style={styles.resendSection}>
                <Text style={styles.resendText}>Didn't receive the code?</Text>
                <TouchableOpacity
                  onPress={handleResendOTP}
                  disabled={resendTimer > 0 || loading}
                  style={styles.resendButton}
                >
                  <Text style={[styles.resendButtonText, (resendTimer > 0 || loading) && styles.resendDisabled]}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonLoading, !isOtpComplete && styles.buttonDisabled]}
                onPress={() => verifyOTP()}
                disabled={loading || !isOtpComplete}
              >
                <Text style={styles.primaryButtonText}>{loading ? "Verifying..." : "Verify & Continue"}</Text>
                {!loading && <Check color="#fff" size={20} />}
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerTextContainer}>
              <Text style={styles.footerText}>By continuing, you agree to our </Text>
              <TouchableOpacity onPress={openTermsOfService}>
                <Text style={styles.footerLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.footerText}> and </Text>
              <TouchableOpacity onPress={openPrivacyPolicy}>
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  backButton: {
    position: "absolute",
    left: -8,
    top: 0,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f8ff",
  },
  iconContainer: {
    marginBottom: 32,
  },
  logoIcon: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  secureIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f6ffed",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#b7eb8f",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  emailInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "#f8f9fa",
    position: "relative",
  },
  emailInputValid: {
    borderColor: "#52c41a",
    backgroundColor: "#f6ffed",
  },
  emailInputInvalid: {
    borderColor: "#ff4d4f",
    backgroundColor: "#fff2f0",
  },
  emailInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 16,
    marginLeft: 12,
  },
  validIcon: {
    position: "absolute",
    right: 16,
  },
  errorMessage: {
    fontSize: 12,
    color: "#ff4d4f",
    marginTop: 8,
    marginLeft: 4,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    gap: 8,
  },
  otpInput: {
    width: 48,
    height: 60,
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    backgroundColor: "#f8f9fa",
  },
  otpInputFilled: {
    borderColor: "#0066cc",
    backgroundColor: "#e6f4ff",
  },
  otpInputDisabled: {
    opacity: 0.6,
  },
  resendSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 16,
    color: "#0066cc",
    fontWeight: "600",
  },
  resendDisabled: {
    color: "#999",
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#0066cc",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#0066cc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonLoading: {
    opacity: 0.8,
  },
  buttonDisabled: {
    backgroundColor: "#d9d9d9",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  securitySection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  securityFeatures: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  securityFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  securityFeatureText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  keyboardContainer: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  footerContent: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
  },
  footerLink: {
    color: "#0066cc",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  footerTextContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
});

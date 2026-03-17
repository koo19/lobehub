#include <napi.h>
#include <cstring>

#ifdef __APPLE__
extern "C" bool panelize(unsigned char *buffer);
extern "C" bool enableNativeDrag(unsigned char *buffer,
                                  double x, double y,
                                  double width, double height);
extern "C" bool disableNativeDrag(unsigned char *buffer);
extern "C" bool animateResize(unsigned char *buffer,
                               double x, double y,
                               double width, double height,
                               double duration);
extern "C" bool animateResizeElectron(unsigned char *buffer,
                                       double x, double y,
                                       double width, double height,
                                       double duration);
#endif

class Panel : public Napi::ObjectWrap<Panel> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Panel", {
      InstanceMethod("panelize", &Panel::Panelize),
      InstanceMethod("enableNativeDrag", &Panel::EnableNativeDrag),
      InstanceMethod("disableNativeDrag", &Panel::DisableNativeDrag),
      InstanceMethod("animateResize", &Panel::AnimateResize),
      InstanceMethod("animateResizeElectron", &Panel::AnimateResizeElectron),
    });

    Napi::FunctionReference *constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("Panel", func);
    return exports;
  }

  Panel(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<Panel>(info), handle_(nullptr), handleLen_(0) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
      Napi::TypeError::New(env,
        "Expected first argument to be a Buffer from getNativeWindowHandle()")
        .ThrowAsJavaScriptException();
      return;
    }

    auto buffer = info[0].As<Napi::Buffer<unsigned char>>();
    handleLen_ = buffer.Length();
    handle_ = new unsigned char[handleLen_];
    memcpy(handle_, buffer.Data(), handleLen_);
  }

  ~Panel() {
    delete[] handle_;
  }

private:
  unsigned char *handle_;
  size_t handleLen_;

  Napi::Value Panelize(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
#ifdef __APPLE__
    bool ok = panelize(handle_);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }

  Napi::Value EnableNativeDrag(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Expected {x, y, width, height}")
        .ThrowAsJavaScriptException();
      return env.Null();
    }

    auto rect = info[0].As<Napi::Object>();
    double x = rect.Get("x").As<Napi::Number>().DoubleValue();
    double y = rect.Get("y").As<Napi::Number>().DoubleValue();
    double w = rect.Get("width").As<Napi::Number>().DoubleValue();
    double h = rect.Get("height").As<Napi::Number>().DoubleValue();

#ifdef __APPLE__
    bool ok = enableNativeDrag(handle_, x, y, w, h);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }

  Napi::Value DisableNativeDrag(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
#ifdef __APPLE__
    bool ok = disableNativeDrag(handle_);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }

  Napi::Value AnimateResize(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Expected {x, y, width, height}")
        .ThrowAsJavaScriptException();
      return env.Null();
    }

    auto frame = info[0].As<Napi::Object>();
    double x = frame.Get("x").As<Napi::Number>().DoubleValue();
    double y = frame.Get("y").As<Napi::Number>().DoubleValue();
    double w = frame.Get("width").As<Napi::Number>().DoubleValue();
    double h = frame.Get("height").As<Napi::Number>().DoubleValue();

    double duration = 0.2;
    if (info.Length() >= 2 && info[1].IsNumber()) {
      duration = info[1].As<Napi::Number>().DoubleValue();
    }

#ifdef __APPLE__
    bool ok = animateResize(handle_, x, y, w, h, duration);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }

  Napi::Value AnimateResizeElectron(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Expected {x, y, width, height}")
        .ThrowAsJavaScriptException();
      return env.Null();
    }

    auto frame = info[0].As<Napi::Object>();
    double x = frame.Get("x").As<Napi::Number>().DoubleValue();
    double y = frame.Get("y").As<Napi::Number>().DoubleValue();
    double w = frame.Get("width").As<Napi::Number>().DoubleValue();
    double h = frame.Get("height").As<Napi::Number>().DoubleValue();

    double duration = 0.2;
    if (info.Length() >= 2 && info[1].IsNumber()) {
      duration = info[1].As<Napi::Number>().DoubleValue();
    }

#ifdef __APPLE__
    bool ok = animateResizeElectron(handle_, x, y, w, h, duration);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return Panel::Init(env, exports);
}

NODE_API_MODULE(electron_panel, Init)

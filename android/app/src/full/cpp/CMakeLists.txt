# The on-device runtime for Kairos Full on Android: llama.cpp + a small JNI
# bridge (kairos_llm.cpp). Built only for the `full` flavor (see app/build.gradle).
cmake_minimum_required(VERSION 3.22.1)
project(kairos_llm C CXX)

include(FetchContent)
# The same llama.cpp commit the desktop build uses (vendored by llama-cpp-sys-2
# 0.1.159), checked by SHA-256 before it is built.
FetchContent_Declare(llama
  URL https://github.com/ggml-org/llama.cpp/archive/26394b4e6749a41c3633db040e0987500a5f7013.tar.gz
  URL_HASH SHA256=1d0fcd22eb0fb31b1f75de2cc9e585a3338b8937043662a0c222a1e9261fed29
)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
# ggml's own thread pool instead of OpenMP: nothing extra to package.
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(llama)

add_library(kairos_llm SHARED kairos_llm.cpp)
target_link_libraries(kairos_llm PRIVATE llama ggml android log)
# 16 KB page alignment: required on Android 15+ devices with 16 KB pages, and by Google Play.
target_link_options(kairos_llm PRIVATE "-Wl,-z,max-page-size=16384")

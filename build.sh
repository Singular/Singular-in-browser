#!/usr/bin/env bash
set -eux

# TODO:
# - add "machinelearning Order singmathic" dyn_modules
# - enable openmp
# - maybe add "-msimd128" for all library?
# - polish code
# - check if there is missing functionality

BASEDIR="$(pwd)"

if ! command -v emmake &> /dev/null; then
    echo "Please install and source Emscripten."
    echo "See https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

AUX_BUILD="$BASEDIR/emscripten/build"
AUX_PREFIX="$BASEDIR/emscripten/install"
EXTERN_DIR="$BASEDIR/emscripten/extern"

mkdir -p "$AUX_BUILD"
mkdir -p "$AUX_PREFIX"
mkdir -p "$EXTERN_DIR"

# Generate autotools scripts if missing
if [[ ! -f ./configure ]]; then
    ./autogen.sh
fi

# --- GMP ---
(
    mkdir -p "$AUX_BUILD/gmp"
    cd "$AUX_BUILD/gmp"
    if [[ ! -d "$EXTERN_DIR/gmp" ]]; then
        echo "Downloading GMP source..."
        hg clone https://gmplib.org/repo/gmp/ "$EXTERN_DIR/gmp"
        cd "$EXTERN_DIR/gmp" && ./.bootstrap && cd -
    fi
    if [[ ! -f config.status ]]; then
        CC_FOR_BUILD=/usr/bin/gcc ABI=standard \
        emconfigure "$EXTERN_DIR/gmp/configure" \
            --build i686-pc-linux-gnu --host none \
            --disable-assembly --enable-cxx \
            --prefix="$AUX_PREFIX"
    fi
    emmake make -j8
    emmake make install
)

# --- MPFR ---
(
    mkdir -p "$AUX_BUILD/mpfr"
    cd "$AUX_BUILD/mpfr"
    if [[ ! -d "$EXTERN_DIR/mpfr" ]]; then
        echo "Downloading MPFR source..."
        git clone https://gitlab.inria.fr/mpfr/mpfr.git "$EXTERN_DIR/mpfr"
        cd "$EXTERN_DIR/mpfr" && ./autogen.sh && cd -
    fi
    if [[ ! -f config.status ]]; then
        emconfigure "$EXTERN_DIR/mpfr/configure" \
            --build i686-pc-linux-gnu --host none \
            --with-gmp="$AUX_PREFIX" \
            --disable-shared \
            --prefix="$AUX_PREFIX"
    fi
    emmake make -j8
    emmake make install
)

# --- FLINT ---
(
    mkdir -p "$AUX_BUILD/flint"
    cd "$AUX_BUILD/flint"
    if [[ ! -d "$EXTERN_DIR/flint2" ]]; then
        echo "Cloning Flint..."
        git clone --depth 1 https://github.com/wbhart/flint2.git "$EXTERN_DIR/flint2"
        cd "$EXTERN_DIR/flint2" && ./bootstrap.sh && cd -
    fi
    if [[ ! -f Makefile ]]; then
        emconfigure "$EXTERN_DIR/flint2/configure" \
            --build=i686-pc-linux-gnu \
            --host=wasm32-unknown-emscripten \
            --with-gmp="$AUX_PREFIX" \
            --with-mpfr="$AUX_PREFIX" \
            --disable-shared \
            --disable-assembly \
            --prefix="$AUX_PREFIX"
    fi
    emmake make -j8
    emmake make install
)

# --- CDDLIB ---
(
    if [[ ! -d "$EXTERN_DIR/cddlib" ]]; then
        echo "Cloning cddlib..."
        git clone https://github.com/cddlib/cddlib.git "$EXTERN_DIR/cddlib"
    fi

    cd "$EXTERN_DIR/cddlib"
    
    if [[ ! -f configure ]]; then
        ./bootstrap
    fi

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CFLAGS="-O2" \
        CXXFLAGS="-O2" \
        emconfigure ./configure \
            --with-gmp="$AUX_PREFIX" \
            --disable-shared \
            --prefix="$AUX_PREFIX"
    fi
    
    emmake make -j8
    emmake make install

    cd "$AUX_PREFIX/include"
    ln -sf cddlib/*.h .
    ln -sf cddmp.h cdd_mp.h
)

# --- NTL ---
(
    mkdir -p "$AUX_BUILD/ntl"
    cd "$AUX_BUILD/ntl"
    
    if [[ ! -d "$EXTERN_DIR/ntl" ]]; then
        echo "Cloning NTL..."
        git clone https://github.com/libntl/ntl.git "$EXTERN_DIR/ntl"
    fi
    cd "$EXTERN_DIR/ntl/src"
    
    if [[ ! -f makefile ]]; then
        emconfigure ./configure \
            CXX="em++" \
            CXXFLAGS="-O2 -fexceptions -s WASM=1 -s NODERAWFS=1" \
            PREFIX="$AUX_PREFIX" \
            GMP_PREFIX="$AUX_PREFIX" \
            NTL_GMP_LIP=on \
            NTL_STD_CXX14=on \
            SHARED=off \
            NATIVE=off \
            TUNE=generic \
            NTL_THREADS=off

        sed -e 's/^CC=gcc/CC=emcc -s NODERAWFS=1/' \
            -e 's/^WIZARD=on/WIZARD=off/' \
            makefile > makefile.patched
        mv makefile.patched makefile
    fi
    
    if ! emmake make -j8; then
        
        sed -e 's|^\t\./MakeDesc|\tchmod +x ./MakeDesc \&\& node ./MakeDesc|' \
            -e 's|^\t\./gen_gmp_aux|\tchmod +x ./gen_gmp_aux \&\& node ./gen_gmp_aux|' \
            -e 's|^\t\./gen_lip_gmp_aux|\tchmod +x ./gen_lip_gmp_aux \&\& node ./gen_lip_gmp_aux|' \
            -e 's|^\t\./gen_lip_gmp_aux|\tchmod +x ./gen_lip_gmp_aux \&\& node ./gen_lip_gmp_aux|' \
            makefile > makefile.patched
        mv makefile.patched makefile
        
        sed -i 's|if ./CheckFeatures|if node ./CheckFeatures|g' MakeCheckFeatures
        
        if [ -f MakeCheckThreads ]; then
            sed -i 's|./CheckThreads|node ./CheckThreads|g' MakeCheckThreads
        fi
        
        emmake make -j8
    fi

    emmake make install
    emranlib "$AUX_PREFIX/lib/libntl.a"
)

# --- NORMALIZ ---
(
    if [[ ! -d "$EXTERN_DIR/normaliz" ]]; then
        echo "Cloning Normaliz..."
        git clone https://github.com/Normaliz/Normaliz.git "$EXTERN_DIR/normaliz"
    fi

    cd "$EXTERN_DIR/normaliz"

    if [[ ! -f configure ]]; then
        echo "Bootstrapping Normaliz..."
        chmod +x bootstrap.sh
        ./bootstrap.sh
    fi

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CFLAGS="-O2 -fexceptions" \
        CXXFLAGS="-O2 -fexceptions -std=c++14" \
        emconfigure ./configure \
            --build=i686-pc-linux-gnu \
            --host=wasm32-unknown-emscripten \
            --with-gmp="$AUX_PREFIX" \
            --with-flint="$AUX_PREFIX" \
            --disable-shared \
            --disable-openmp \
            --prefix="$AUX_PREFIX"
    fi
    
    emmake make -j8
    emmake make install
)

# --- MEMTAILOR ---
(
    mkdir -p "$AUX_BUILD/memtailor"
    cd "$AUX_BUILD/memtailor"
    
    if [[ ! -d "$EXTERN_DIR/memtailor" ]]; then
        echo "Cloning Memtailor..."
        git clone https://github.com/broune/memtailor.git "$EXTERN_DIR/memtailor"
        
        # Generate configure script
        cd "$EXTERN_DIR/memtailor"
        ./autogen.sh
        cd -
    fi

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CXXFLAGS="-O2 -fexceptions -std=gnu++0x" \
        emconfigure "$EXTERN_DIR/memtailor/configure" \
            --host=wasm32-unknown-emscripten \
            --with-gtest=no \
            --disable-shared \
            --prefix="$AUX_PREFIX"
    fi
    
    emmake make -j8
    emmake make install
)

# --- MATHIC ---
(
    mkdir -p "$AUX_BUILD/mathic"
    cd "$AUX_BUILD/mathic"
    
    if [[ ! -d "$EXTERN_DIR/mathic" ]]; then
        echo "Cloning Mathic..."
        git clone https://github.com/broune/mathic.git "$EXTERN_DIR/mathic"
        
        sed -i 's/bool operator==(iterator it)/bool operator==(const iterator\& it)/g' "$EXTERN_DIR/mathic/src/mathic/DivList.h"
        sed -i 's/bool operator!=(iterator it)/bool operator!=(const iterator\& it)/g' "$EXTERN_DIR/mathic/src/mathic/DivList.h"
        
        sed -i 's/struct Bucket/public: struct Bucket/g' "$EXTERN_DIR/mathic/src/mathic/Geobucket.h"
        
        cd "$EXTERN_DIR/mathic"
        ./autogen.sh
        cd -
    fi

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CXXFLAGS="-O2 -fexceptions -std=gnu++0x" \
        emconfigure "$EXTERN_DIR/mathic/configure" \
            --host=wasm32-unknown-emscripten \
            --with-gtest=no \
            --disable-shared \
            --prefix="$AUX_PREFIX" \
            MEMTAILOR_CFLAGS="-I$AUX_PREFIX/include" \
            MEMTAILOR_LIBS="-L$AUX_PREFIX/lib -lmemtailor"
    fi
    
    emmake make -j8
    emmake make install
)

# --- MATHICGB ---
(
    mkdir -p "$AUX_BUILD/mathicgb"
    cd "$AUX_BUILD/mathicgb"

    if [[ ! -d "$EXTERN_DIR/mathicgb" ]]; then
        echo "Cloning MathicGB..."
        git clone https://github.com/broune/mathicgb.git "$EXTERN_DIR/mathicgb"
    fi

    cd "$EXTERN_DIR/mathicgb"
    if [[ ! -f configure ]]; then

        sed -i '/friend void mathic::PairQueueNamespace::constructPairData/{n;s/Index/mathic::PairQueueNamespace::Index/g;}' src/mathicgb/SPairs.hpp
        sed -i '/friend void mathic::PairQueueNamespace::destructPairData/{n;s/Index/mathic::PairQueueNamespace::Index/g;}' src/mathicgb/SPairs.hpp

        sed -i '466s/Coefficient coef/Coefficient coef_in/' src/mathicgb/MathicIO.hpp
        sed -i '470a \      typename std::remove_const<Coefficient>::type coef = coef_in;' src/mathicgb/MathicIO.hpp
        sed -i '1i #include <type_traits>' src/mathicgb/MathicIO.hpp

        ./autogen.sh
    fi
    cd "$AUX_BUILD/mathicgb"

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CXXFLAGS="-O2 -fexceptions -std=gnu++11 -Wno-delete-abstract-non-virtual-dtor -Wno-null-dereference " \
        emconfigure "$EXTERN_DIR/mathicgb/configure" \
            --host=wasm32-unknown-emscripten \
            --with-tbb=no \
            --with-gtest=no \
            --disable-shared \
            --prefix="$AUX_PREFIX" \
            MEMTAILOR_CFLAGS="-I$AUX_PREFIX/include" \
            MEMTAILOR_LIBS="-L$AUX_PREFIX/lib -lmemtailor" \
            MATHIC_CFLAGS="-I$AUX_PREFIX/include" \
            MATHIC_LIBS="-L$AUX_PREFIX/lib -lmathic"
    fi

    emmake make -j8
    emmake make install
)

# --- GIVARO ---
(
    mkdir -p "$AUX_BUILD/givaro"
    cd "$AUX_BUILD/givaro"
    
    if [[ ! -d "$EXTERN_DIR/givaro" ]]; then
        echo "Cloning Givaro..."
        git clone https://github.com/linbox-team/givaro.git "$EXTERN_DIR/givaro"
        
        cd "$EXTERN_DIR/givaro"
        NOCONFIGURE=1 ./autogen.sh
        cd -
    fi

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CXXFLAGS="-O2 -fexceptions -std=c++11" \
        emconfigure "$EXTERN_DIR/givaro/configure" \
            --host=wasm32-unknown-emscripten \
            --with-gmp="$AUX_PREFIX" \
            --without-archnative \
            --disable-shared \
            --prefix="$AUX_PREFIX"
    fi
    
    emmake make -j8
    emmake make install
)

# --- OPENBLAS ---
(
    if [[ ! -d "$EXTERN_DIR/openblas" ]]; then
        echo "Cloning OpenBLAS..."
        git clone https://github.com/OpenMathLib/OpenBLAS.git "$EXTERN_DIR/openblas"
    fi

    cd "$EXTERN_DIR/openblas"
    
    if [[ ! -f libopenblas.a ]]; then

        make -j8 \
            HOSTCC=gcc \
            CC="emcc -fexceptions -msimd128" \
            AR=emar \
            RANLIB=emranlib \
            TARGET=WASM128_GENERIC \
            NOFORTRAN=1 \
            NO_LAPACK=1 \
            USE_THREAD=0
    fi
    
    make PREFIX="$AUX_PREFIX" install
    cd -
)

# --- FFLAS-FFPACK ---
(
    mkdir -p "$AUX_BUILD/fflas-ffpack"
    cd "$AUX_BUILD/fflas-ffpack"
    
    if [[ ! -d "$EXTERN_DIR/fflas-ffpack" ]]; then
        echo "Cloning FFLAS-FFPACK..."
        git clone https://github.com/linbox-team/fflas-ffpack.git "$EXTERN_DIR/fflas-ffpack"
        
        cd "$EXTERN_DIR/fflas-ffpack"
        NOCONFIGURE=1 ./autogen.sh
        cd -
    fi

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib -msimd128 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=128MB" \
        CFLAGS="-O2 -fexceptions -msimd128" \
        CXXFLAGS="-O2 -fexceptions -std=c++11 -msimd128" \
        emconfigure "$EXTERN_DIR/fflas-ffpack/configure" \
            --host=wasm32-unknown-emscripten \
            --without-archnative \
            --disable-openmp \
            --with-blas-libs="$AUX_PREFIX/lib/libopenblas.a" \
            --with-blas-cflags="-I$AUX_PREFIX/include" \
            --disable-shared \
            --prefix="$AUX_PREFIX" \
            GIVARO_CFLAGS="-I$AUX_PREFIX/include" \
            GIVARO_LIBS="-L$AUX_PREFIX/lib -lgivaro -lgmp"
    fi
    
    emmake make -j8
    emmake make install
)

# --- SPASM ---
(
    mkdir -p "$AUX_BUILD/spasm"
    cd "$AUX_BUILD/spasm"
    
    if [[ ! -d "$EXTERN_DIR/spasm" ]]; then
        echo "Cloning SpaSM..."
        git clone https://github.com/cbouilla/spasm.git "$EXTERN_DIR/spasm"
        
        cd "$EXTERN_DIR/spasm"
        sed -i 's/add_subdirectory(tools)/#add_subdirectory(tools)/g' CMakeLists.txt
        sed -i 's/add_subdirectory(tests)/#add_subdirectory(tests)/g' CMakeLists.txt
        sed -i 's/add_subdirectory(bench)/#add_subdirectory(bench)/g' CMakeLists.txt
        
        sed -i 's/find_package(OpenMP REQUIRED)//g' CMakeLists.txt
        find . -type f -name "CMakeLists.txt" -exec sed -i 's/OpenMP::OpenMP_C//g; s/OpenMP::OpenMP_CXX//g' {} +
        cd -
    fi

    cp "$BASEDIR/emscripten/omp.h" "$AUX_PREFIX/include/omp.h"
    sed -i '/openmp was not detected correctly at configure time/d' \
        "$AUX_PREFIX/include/fflas-ffpack/fflas-ffpack-config.h"

    if [[ ! -f Makefile ]]; then
        emcmake cmake "$EXTERN_DIR/spasm" \
            -DCMAKE_INSTALL_PREFIX="$AUX_PREFIX" \
            -DCMAKE_PREFIX_PATH="$AUX_PREFIX" \
            -DBUILD_SHARED_LIBS=OFF \
            -DCMAKE_C_FLAGS="-Wno-unknown-pragmas -include omp.h -Wno-error -msimd128" \
            -DCMAKE_CXX_FLAGS="-Wno-unknown-pragmas -include omp.h -Wno-error -msimd128"
    fi
    
    emmake make -j8
    cp "$AUX_BUILD/spasm/src/libspasm.a" "$AUX_PREFIX/lib/libspasm.a"
)

# --- GLPK ---
(
    mkdir -p "$AUX_BUILD/glpk"
    cd "$AUX_BUILD/glpk"
    
    if [[ ! -d "$EXTERN_DIR/glpk" ]]; then
        echo "Downloading GLPK source..."
        mkdir -p "$EXTERN_DIR/glpk"
        curl -sL "https://ftp.gnu.org/gnu/glpk/glpk-5.0.tar.gz" | tar -xz -C "$EXTERN_DIR/glpk" --strip-components=1
    fi

    cd "$EXTERN_DIR/glpk"
    
    if [[ ! -f configure ]]; then
        echo "Bootstrapping GLPK..."
        chmod +x autogen.sh
        ./autogen.sh
    fi
    
    cd "$AUX_BUILD/glpk"

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CFLAGS="-O2 -fexceptions" \
        emconfigure "$EXTERN_DIR/glpk/configure" \
            --build=i686-pc-linux-gnu \
            --host=none \
            --with-gmp \
            --disable-shared \
            --enable-static \
            --prefix="$AUX_PREFIX"
    fi
    
    emmake make -j8
    emmake make install
)

# --- 4TI2 ---
(
    mkdir -p "$AUX_BUILD/4ti2"
    cd "$AUX_BUILD/4ti2"
    
    if [[ ! -d "$EXTERN_DIR/4ti2" ]]; then
        echo "Cloning 4ti2..."
        git clone https://github.com/4ti2/4ti2.git "$EXTERN_DIR/4ti2"
    fi

    cd "$EXTERN_DIR/4ti2"
    
    if [[ ! -f configure ]]; then
        echo "Bootstrapping 4ti2..."
        chmod +x autogen.sh
        ./autogen.sh
    fi

    if ! grep -q "4ti2 wasm patch" configure; then
        cp configure configure.orig

        sed -i '/checking whether -ftrapv actually seems to work for int\.\.\./,/^then :$/ s/if test "\$cross_compiling" = yes/if false/' configure
        sed -i '/checking whether -ftrapv actually seems to work for long long\.\.\./,/^then :$/ s/if test "\$cross_compiling" = yes/if false/' configure
        sed -i '1i # 4ti2 wasm patch applied' configure
    fi

        cd "$AUX_BUILD/4ti2"

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CFLAGS="-O2 -fexceptions" \
        CXXFLAGS="-O2 -fexceptions" \
        emconfigure bash "$EXTERN_DIR/4ti2/configure" \
            --build=i686-pc-linux-gnu \
            --host=wasm32-unknown-emscripten \
            --with-gmp="$AUX_PREFIX" \
            --with-glpk="$AUX_PREFIX" \
            --disable-shared \
            --enable-static \
            --prefix="$AUX_PREFIX"
    fi
    
    emmake make -j8
    emmake make install
)

# --- CCLUSTER ---
(
    mkdir -p "$AUX_BUILD/ccluster"
    cd "$AUX_BUILD/ccluster"
    
    if [[ ! -d "$EXTERN_DIR/ccluster" ]]; then
        echo "Cloning Ccluster..."
        git clone https://github.com/rimbach/Ccluster.git "$EXTERN_DIR/ccluster"
    fi

    cd "$EXTERN_DIR/ccluster"
    
    if [[ ! -f Makefile ]]; then

        CFLAGS="-O2 -fexceptions -I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib" \
        CC="emcc -fexceptions" \
        emconfigure ./configure \
            --prefix="$AUX_PREFIX" \
            --with-gmp="$AUX_PREFIX" \
            --with-mpfr="$AUX_PREFIX" \
            --with-flint="$AUX_PREFIX" 
    fi
    
    emmake make static -j8
    
    emmake make install CCLUSTER_SHARED=0 CCLUSTER_STATIC=1
)

# --- TOPCOM ---
(
    mkdir -p "$AUX_BUILD/topcom"
    cd "$AUX_BUILD/topcom"
    
    if [[ ! -d "$EXTERN_DIR/topcom" ]]; then
        echo "Downloading TOPCOM source..."
        mkdir -p "$EXTERN_DIR/topcom"
        curl -sL "https://www.wm.uni-bayreuth.de/de/team/rambau_joerg/TOPCOM-Downloads/TOPCOM-1_2_0_eta.tgz" | tar -xz -C "$EXTERN_DIR/topcom" --strip-components=1
    fi

    if [[ ! -f Makefile ]]; then
        CPPFLAGS="-I$AUX_PREFIX/include" \
        LDFLAGS="-L$AUX_PREFIX/lib -static -s USE_PTHREADS=0" \
        CFLAGS="-O2 -fexceptions -s USE_PTHREADS=0" \
        CXXFLAGS="-O2 -fexceptions -std=c++17 -s USE_PTHREADS=0" \
        emconfigure "$EXTERN_DIR/topcom/configure" \
            --build=i686-pc-linux-gnu \
            --host=wasm32-unknown-emscripten \
            --disable-shared \
            --enable-static \
            --prefix="$AUX_PREFIX"
            
        find . -type f -name "Makefile" -exec sed -i 's/ -pthread / /g; s/ -pthread$/ /g' {} +
        if [ -f libtool ]; then 
            sed -i 's/ -pthread / /g' libtool
            sed -i 's/"-pthread /"/g' libtool
            sed -i 's/ -pthread"/"/g' libtool
        fi
    fi
    
    emmake make -j8
    emmake make install
)

cd "$BASEDIR"

export EMCC_CFLAGS="-fexceptions -msimd128"
export PKG_CONFIG_PATH="$AUX_PREFIX/lib/pkgconfig"

# The SINGULAR_MODULES is obtained from "configure.ac", with "python", "pyobject" and "systhreads" removed

# I get the following warning for "machinelearning Order singmathic":
# warning: undefined symbol: Order_mod_init (referenced by top-level compiled C/C++ code)
# warning: undefined symbol: machinelearning_mod_init (referenced by top-level compiled C/C++ code)
# warning: undefined symbol: singmathic_mod_init (referenced by top-level compiled C/C++ code)
# I have no idea how to fix it

SINGULAR_MODULES="bigintm syzextra gfanlib customstd staticdemo subsets freealgebra partialgb gitfan interval cohomo loctriv sispasm"

MODULES_CSV="${SINGULAR_MODULES// /,}"

cp "$BASEDIR/emscripten/wasm_patch.c" "$BASEDIR/Singular"

emcc -c "$BASEDIR/emscripten/wasm_patch.c" -o "$BASEDIR/wasm_patch.o"
emar rcs "$BASEDIR/libwasm_patch.a" "$BASEDIR/wasm_patch.o"

emconfigure ./configure \
    ac_cv_func_qsort_r=no \
    --host=wasm32-unknown-emscripten \
    --with-gmp="$AUX_PREFIX" \
    --with-mpfr="$AUX_PREFIX" \
    --with-flint="$AUX_PREFIX" \
    --with-cdd="$AUX_PREFIX" \
    --with-ntl="$AUX_PREFIX" \
    --with-normaliz="$AUX_PREFIX" \
    --with-topcom="$AUX_PREFIX" \
    --with-mathicgb="$AUX_PREFIX" \
    --with-ccluster="$AUX_PREFIX" \
    --disable-shared \
    --enable-static \
    --without-pic \
    --without-readline \
    --enable-gfanlib \
    --disable-polymake \
    --disable-pthreads \
    --disable-omalloc \
    --enable-p-procs-static \
    --disable-p-procs-dynamic \
    --with-builtinmodules=$MODULES_CSV \
    MATHICGB_CFLAGS="-I$AUX_PREFIX/include" \
    MATHICGB_LIBS="-L$AUX_PREFIX/lib -lmathicgb -lmathic -lmemtailor" \
    CXX="em++ -fexceptions" \
    CC="emcc -fexceptions" \
    CXXFLAGS="-O2 -fexceptions -D_GNU_SOURCE -std=c++14 -I$AUX_PREFIX/include -I$AUX_PREFIX/include/flint -I$AUX_PREFIX/include/cddlib" \
    CFLAGS="-O2 -fexceptions -D_GNU_SOURCE -I$AUX_PREFIX/include -I$AUX_PREFIX/include/flint -I$AUX_PREFIX/include/cddlib" \
    LDFLAGS="-L$AUX_PREFIX/lib -L$BASEDIR -lwasm_patch -fexceptions -s ASYNCIFY=1 -s ALLOW_MEMORY_GROWTH=1 -s USE_PTHREADS=0 -O2"

emmake make -j8 -k || true

echo "Building static modules..."

for mod in $SINGULAR_MODULES; do
    echo "Building module: $mod"
    emmake make -C "Singular/dyn_modules/$mod" -j8
done

cd Singular

emmake make all.lib

cp -f all.lib LIB/

MODULE_LIBS=""

for mod in $SINGULAR_MODULES; do
    MODULE_LIBS="$MODULE_LIBS dyn_modules/$mod/.libs/lib${mod}.a"
done

# See "Singular/Makefile.am"
em++ wasm_patch.c tesths.o utils.o \
    -Wl,--start-group \
    ./.libs/libSingular.a \
    ../kernel/.libs/libkernel.a \
    ../libpolys/polys/.libs/libpolys.a \
    ../libpolys/coeffs/.libs/libcoeffs.a \
    ../libpolys/misc/.libs/libmisc.a \
    ../libpolys/reporter/.libs/libreporter.a \
    ../factory/.libs/libfactory.a \
    ../gfanlib/.libs/libgfan.a \
    ../resources/.libs/libsingular_resources.a \
    $MODULE_LIBS \
    -Wl,--end-group \
    -L"$AUX_PREFIX/lib" \
    -lmathicgb -lmathic -lmemtailor \
    -lspasm -lopenblas -lgivaro \
    -lTOPCOM -lnormaliz -lccluster -lflint -lmpfr -lcddgmp -lntl \
    -l4ti2int64 -l4ti2int32 -l4ti2common -lzsolve \
    -lglpk -lgmp \
    -s ASYNCIFY=1 \
    -s TOTAL_STACK=64MB \
    -s INITIAL_MEMORY=1024MB \
    -s ALLOW_MEMORY_GROWTH=1 \
    -fexceptions \
    -O2 \
    -msimd128 \
    --preload-file LIB@/LIB \
    --preload-file ../doc@/info \
    -o Singular.html

echo "Build complete."

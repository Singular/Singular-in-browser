#ifndef OMP_H
#define OMP_H
static inline int omp_get_thread_num() { return 0; }
static inline int omp_get_max_threads() { return 1; }
static inline int omp_get_num_threads() { return 1; }
static inline double omp_get_wtime() { return 0.0; }
#endif